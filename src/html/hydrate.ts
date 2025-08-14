import { root } from '@esportsplus/reactivity';
import { EMPTY_FRAGMENT } from '~/constants';
import { Elements, Fragment, RenderableReactive, RenderableTemplate } from '~/types';
import { Slot } from '~/slot';
import { cloneNode } from '~/utilities';
import cache from './cache';


function reactive<T>(elements: Elements[], fragment: Fragment, renderable: RenderableReactive<T>, slot: Slot) {
    let array = renderable.values,
        factory = renderable.template,
        refresh = () => {
            root(() => array.map(template));

            slot.clear();
            slot.anchor().after(fragment);
            slot.nodes = elements;

            reset();
        },
        reset = () => {
            elements = [];
            fragment = cloneNode.call(EMPTY_FRAGMENT);
        },
        template = function(data, i) {
            hydrate(elements, fragment, factory.call(this, data, i));
        } as (this: typeof array, ...args: Parameters<Parameters<typeof array['map']>[0]>) => void;

    array.on('clear', () => slot.clear());
    array.on('pop', () => slot.pop());
    array.on('reverse', refresh);
    array.on('shift', () => slot.shift());
    array.on('sort', refresh);

    array.on('push', ({ items }) => {
        let anchor = slot.anchor();

        elements = slot.nodes;

        root(() => array.map(template, array.length - items.length));

        anchor.after(fragment);
        reset();
    });
    array.on('splice', ({ deleteCount: d, items: i, start: s }) => {
        if (array.length === 0) {
            slot.clear();
            return;
        }

        root(() => array.map(template, s, i.length))

        slot.splice(s, d, fragment, ...elements);
        reset();
    });
    array.on('unshift', ({ items }) => {
        root(() => array.map(template, 0, items.length))

        slot.unshift(fragment, ...elements);
        reset();
    });

    root(() => array.map(template));
    reset();
}

function hydrate<T>(elements: Elements[] | null, fragment: Fragment, renderable: RenderableTemplate<T>) {
    let { fragment: frag, slots } = cache.get(renderable.literals),
        clone = cloneNode.call(frag, true);

    if (slots !== null) {
        let node,
            nodePath,
            parent,
            parentPath,
            values = renderable.values;

        for (let i = 0, n = slots.length; i < n; i++) {
            let { fn, path, slot } = slots[i],
                pp = path.parent,
                pr = path.relative;

            if (pp !== parentPath) {
                if (pp === nodePath) {
                    parent = node;
                    parentPath = nodePath;

                    nodePath = undefined;
                }
                else {
                    parent = clone;
                    parentPath = pp;

                    for (let o = 0, j = pp.length; o < j; o++) {
                        parent = pp[o].call(parent);
                    }
                }
            }

            if (pr !== nodePath) {
                node = parent;
                nodePath = path.absolute;

                for (let o = 0, j = pr.length; o < j; o++) {
                    node = pr[o].call(node);
                }
            }

            // @ts-ignore
            fn(node, values[slot]);
        }
    }

    if (elements) {
        elements.push([...clone.childNodes] as Elements);
    }

    fragment.appendChild(clone)
}


export default {
    reactive,
    static: hydrate
};