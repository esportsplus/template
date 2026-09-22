import { root } from '@esportsplus/reactivity';
import { isObject, EMPTY_OBJECT } from '@esportsplus/utilities';
import { CLEANUP } from './constants';
import { Attributes, Element, Renderable } from './types';
import { marker } from './utilities';
import { setProperties } from './attributes';
import { EffectSlot, remove, render as node } from './slot';


type A = Attributes;

type C<T> = Renderable<T>;

type E = HTMLElement;


function render(parent: E, attributes: A): VoidFunction;
function render<T>(parent: E, content: C<T>): VoidFunction;
function render<T>(parent: E, attributes: A, content: C<T>): VoidFunction;
function render<T>(parent: E, one?: A | C<T>, two?: C<T>): VoidFunction {
    let anchor = marker.cloneNode() as unknown as Element,
        cleanup = ((parent as unknown as Element)[CLEANUP] ??= []) as VoidFunction[],
        start = cleanup.length;

    if (arguments.length === 2 && !isObject(one)) {
        two = one as Renderable<T>;
        one = EMPTY_OBJECT as A;
    }

    parent.append(anchor);

    return root(dispose => {
        setProperties(parent as Element, (one || EMPTY_OBJECT) as A);

        let count = cleanup.length - start,
            slot: EffectSlot | null = null,
            tail: Element = anchor;

        if (typeof two === 'function') {
            slot = new EffectSlot(anchor, two);
        }
        else {
            let content = node(two as Renderable<T>);

            tail = ((content.nodeType === 11 ? content.lastChild : content) || anchor) as Element;
            anchor.after(content);
        }

        return () => {
            if (slot) {
                slot.dispose();
            }
            else {
                remove([{ head: anchor, tail }]);
            }

            // Attribute bindings on the parent are the only cleanups render added to it
            let fns = cleanup.splice(start, count);

            for (let i = 0, n = fns.length; i < n; i++) {
                fns[i]();
            }

            dispose();
        };
    });
}


export default render;
