import { root } from '@esportsplus/reactivity';
import { EMPTY_OBJECT } from '@esportsplus/utilities';
import { Attributes, Element, Renderable } from './types';
import { marker } from './utilities';
import { setProperties } from './attributes';
import { EffectSlot, render as node } from './slot';
import { adopt, context, detach, enter, exit, track } from './slot/cleanup';
import type { Slot } from './slot/cleanup';


type A = Attributes;

// Called once, untracked, inside render()'s root: what it builds is owned by that root
type C<T> = () => Renderable<T>;

type E = HTMLElement;


function render(parent: E, attributes: A): VoidFunction;
function render<T>(parent: E, content: C<T>): VoidFunction;
function render<T>(parent: E, attributes: A, content: C<T>): VoidFunction;
function render<T>(parent: E, one?: A | C<T>, two?: C<T>): VoidFunction {
    let anchor = marker.cloneNode() as unknown as Element;

    if (typeof one === 'function') {
        two = one;
        one = EMPTY_OBJECT as A;
    }

    parent.append(anchor);

    // Everything bound here, the attributes set on the parent included, belongs to this root, so releasing it is
    // the whole teardown short of removing the nodes
    return root(dispose => {
        let effect: EffectSlot | null = null,
            slot: Slot = {
                anchor,
                disposed: false,
                parent: context(),
                release: dispose,
                state: 0
            },
            tail: Element = anchor,
            prev = enter(slot);

        try {
            setProperties(parent as Element, (one || EMPTY_OBJECT) as A);

            let content = two ? two() : undefined;

            // A factory returning a function renders it reactively, as any function slot does
            if (typeof content === 'function') {
                effect = new EffectSlot(anchor, content);
            }
            else {
                let nodes = node(content);

                // Content the factory returns but did not build, built outside any owner, is owned from here
                adopt(nodes);
                tail = ((nodes.nodeType === 11 ? nodes.lastChild : nodes) || anchor) as Element;
                anchor.after(nodes);
            }
        }
        finally {
            exit(prev);
        }

        track(slot);

        return () => {
            slot.disposed = true;

            try {
                dispose();
            }
            finally {
                if (effect) {
                    effect.dispose();
                }
                else {
                    detach({ head: anchor, tail });
                }
            }
        };
    });
}


export default render;
