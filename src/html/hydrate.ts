import { root, ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_REACTIVE } from '~/constants';
import { Element, Elements, Renderable, RenderableReactive, RenderableStatic, Template } from '~/types';
import { Slot } from '~/slot';
import { cloneNode, firstChild, fragment, nextSibling } from '~/utilities';
import a from '~/attributes';
import cache from './cache';


function clone(template: Template) {
    if (typeof template.fragment === 'boolean') {
        if (template.fragment === true) {
            template.fragment = fragment(template.html);
        }
        else {
            template.fragment = true;

            return fragment(template.html);
        }
    }

    return cloneNode.call(template.fragment, true);
}

function reactive<T>(renderable: RenderableReactive<T>, level: number, slot: Slot) {
    let array = renderable.values,
        factory = renderable.template,
        refresh = () => {
            slot.length = 0;
            reactive(renderable, 1, slot);
        },
        render = (i: number, n?: number) => {
            return root(() => template(array, factory, level, i, n), scheduler);
        },
        renderables = array.map( factory ),
        scheduler = root((scope) => scope.scheduler);

    array.on('pop', () => slot.pop());
    array.on('push', ({ items }) => slot.push(...render(array.length - items.length)));
    array.on('reverse', refresh);
    array.on('shift', () => slot.shift());
    array.on('sort', refresh);
    array.on('splice', ({ deleteCount: d, items: i, start: s }) => slot.splice(s, d, ...render(s, i.length)));
    array.on('unshift', ({ items }) => slot.unshift(...render(0, items.length)));

    return template(array, factory, level, 0, renderables.length);
}

function render<T>(renderable: Renderable<T>, template: Template) {
    let elements: Elements = [],
        fragment = clone(template),
        slots = template.slots;

    if (slots !== null) {
        let node,
            previous,
            values = renderable.values;

        for (let i = slots.length - 1; i >= 0; i--) {
            let { fn, name, path, slot } = slots[i];

            if (path === previous) {}
            else {
                a.apply(node);

                node = fragment;
                previous = path;

                for (let o = 0, j = path.length; o < j; o++) {
                    node = path[o].call(node as Element);
                }
            }

            // @ts-ignore
            fn(node, values[slot], name);
        }

        a.apply(node);
    }

    for (let element = firstChild.call(fragment as Element); element; element = nextSibling.call(element)) {
        elements.push(element);
    }

    return elements;
}

function template<T>(array: ReactiveArray<T>, template: RenderableReactive<T>['template'], level: number, i: number, n?: number) {
    let groups: Elements[] = [],
        renderables = array.map< RenderableStatic >(template, i, n);

    for (let i = 0, n = renderables.length; i < n; i++) {
        let renderable = renderables[i];

        groups.push(
            render(renderable, cache.get(renderable, level))
        );
    }

    return groups;
}


export default <T>(renderable: Renderable<T>, level: number, slot?: Slot) => {
    if (renderable[RENDERABLE] === RENDERABLE_REACTIVE) {
        if (slot === undefined) {
            throw new Error(`Template: reactive renderable is missing a slot: ${JSON.stringify(renderable)}`);
        }

        return reactive(renderable, level, slot);
    }

    return render(renderable, renderable.template || (renderable.template = cache.get(renderable, level)));
};