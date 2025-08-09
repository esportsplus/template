import { root } from '@esportsplus/reactivity';
import { Element, Elements, Renderable, RenderableReactive, RenderableTemplate, RenderedGroup, Template } from '~/types';
import { Slot } from '~/slot';
import { cloneNode, firstChild, nextSibling } from '~/utilities';
import { apply } from '~/attributes';
import cache from './cache';


function reactive<T>(renderable: RenderableReactive<T>, slot: Slot) {
    let array = renderable.values,
        factory = renderable.template,
        refresh = () => {
            slot.render(
                root(() => array.map(template))
            );
        },
        renderer = (i: number, n?: number) => {
            return root(() => array.map(template, i, n)) as RenderedGroup[];
        },
        template = function(data, i) {
            let renderable = factory.call(this, data, i);

            return render(renderable, cache.get(renderable));
        } as Parameters<typeof array['map']>[0];

    array.on('pop', () => {
        slot.pop();
    });
    array.on('push', ({ items }) => {
        slot.push(...renderer(array.length - items.length));
    });
    array.on('reverse', refresh);
    array.on('shift', () => {
        slot.shift();
    });
    array.on('sort', refresh);
    array.on('splice', ({ deleteCount: d, items: i, start: s }) => {
        slot.splice(s, d, ...renderer(s, i.length));
    });
    array.on('unshift', ({ items }) => {
        slot.unshift(...renderer(0, items.length));
    });

    return array.map(template) as RenderedGroup[];
}

function render<T>(renderable: Renderable<T>, template: Template) {
    let elements: Elements = [],
        fragment = cloneNode.call(template.fragment, true),
        slots = template.slots;

    if (slots !== null) {
        let node,
            previous,
            values = renderable.values;

        for (let i = slots.length - 1; i >= 0; i--) {
            let { fn, path, slot } = slots[i];

            if (path !== previous) {
                apply(node);

                node = fragment;
                previous = path;

                for (let o = 0, j = path.length; o < j; o++) {
                    node = path[o].call(node as Element);
                }
            }

            // @ts-ignore
            fn(node, values[slot]);
        }

        apply(node);
    }

    for (let element = firstChild.call(fragment as Element); element; element = nextSibling.call(element)) {
        elements.push(element);
    }

    return { elements, fragment };
}


export default {
    reactive: <T>(renderable: RenderableReactive<T>, slot: Slot) => {
        return reactive(renderable, slot);
    },
    static: <T>(renderable: RenderableTemplate<T>) => {
        return render(renderable, renderable.template || (renderable.template = cache.get(renderable)));
    }
};