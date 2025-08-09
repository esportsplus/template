import { effect, root } from '@esportsplus/reactivity';
import { isArray, isFunction, isInstanceOf, isObject  } from '@esportsplus/utilities';
import { RENDERABLE, RENDERABLE_REACTIVE, SLOT_CLEANUP } from './constants';
import { hydrate } from './html';
import { Element, Elements, RenderableReactive, RenderableTemplate, RenderedGroup } from './types';
import { append, firstChild, fragment, microtask, nextSibling, nodeValue, raf, text } from './utilities'
import queue from '@esportsplus/queue';


let cleanup = queue<VoidFunction[]>(64),
    fallback = fragment(''),
    scheduled = false;


function after(anchor: Element, groups: RenderedGroup[]) {
    let elements: Elements[] = [],
        n = groups.length;

    if (n) {
        let fragment = groups[0].fragment || fallback;

        if (n === 1) {
            elements.push( groups[0].elements );
        }
        else {
            for (let i = 1; i < n; i++) {
                let group = groups[i];

                if (group.fragment) {
                    append.call(fragment, group.fragment);
                    group.fragment = null;
                }

                elements.push(group.elements);
            }
        }

        anchor.after(fragment);
        groups[0].fragment = null;
    }

    return elements;
}

function remove(...groups: Elements[]) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i];

        for (let j = 0, o = group.length; j < o; j++) {
            let item = group[j];

            if (item[SLOT_CLEANUP]) {
                cleanup.add(item[SLOT_CLEANUP]);
            }

            item.remove();
        }
    }

    if (!scheduled && cleanup.length) {
        schedule();
    }

    return groups;
}

function render(groups: RenderedGroup[], input: unknown, slot?: Slot) {
    if (input === false || input == null || input === '') {
        return groups;
    }

    if (isArray(input)) {
        for (let i = 0, n = input.length; i < n; i++) {
            render(groups, input[i]);
        }
    }
    else if (isObject(input) && RENDERABLE in input) {
        if (input[RENDERABLE] === RENDERABLE_REACTIVE) {
            groups.push(
                ...hydrate.reactive(input as RenderableReactive, slot!)
            );
        }
        else {
            groups.push(
                hydrate.static(input as RenderableTemplate<unknown>)
            );
        }
    }
    else if (isInstanceOf(input, NodeList)) {
        let elements: Elements = [];

        for (let node = firstChild.call(input); node; node = nextSibling.call(node)) {
            elements.push(node);
        }

        groups.push({ elements, fragment: null });
    }
    else if (isInstanceOf(input, Node)) {
        groups.push({
            elements: [ input as Element ],
            fragment: input as RenderedGroup['fragment']
        });
    }
    else {
        let element = text( typeof input === 'string' ? input : String(input) );

        if (slot) {
            slot.text = element;
        }

        groups.push({
            elements: [ element ],
            fragment: element
        });
    }

    return groups;
}

function schedule() {
    if (scheduled) {
        return;
    }

    scheduled = true;
    microtask.add(task);
}

function task() {
    let fn, fns;

    while (fns = cleanup.next()) {
        try {
            while (fn = fns.pop()) {
                fn();
            }
        }
        catch { }
    }

    scheduled = false;

    if (cleanup.length) {
        schedule();
    }
}


class Slot {
    marker: Element;
    nodes: Elements[];
    text: Element | null = null;


    constructor(marker: Element) {
        ondisconnect(marker, () => this.clear());

        this.marker = marker;
        this.nodes = [];
    }


    get length() {
        return this.nodes.length;
    }

    set length(n: number) {
        this.splice(n);
    }


    anchor(index: number = this.nodes.length - 1) {
        let node,
            nodes = this.nodes[index];

        if (nodes) {
            node = nodes.at(-1);
        }

        return node || this.marker;
    }

    clear() {
        remove(...this.nodes);
        this.nodes.length = 0;
        this.text = null;
    }

    pop() {
        let group = this.nodes.pop();

        if (!group) {
            return undefined;
        }

        return remove(group);
    }

    push(...groups: RenderedGroup[]) {
        return this.nodes.push( ...after(this.anchor(), groups) );
    }

    render(input: unknown) {
        if (isFunction(input)) {
            ondisconnect(
                this.marker,
                effect(() => {
                    let v = input();

                    if (isFunction(v)) {
                        root(() => this.render(v()));
                    }
                    else {
                        raf.add(() => {
                            this.render(v);
                        });
                    }
                })
            );

            return this;
        }

        if (this.text) {
            let type = typeof input;

            if (type === 'object' && input !== null) {
            }
            else if (this.text.isConnected) {
                nodeValue.call(
                    this.text,
                    (type === 'string' || type === 'number') ? input : ''
                );
                return this;
            }
        }

        this.clear();
        this.nodes = after(this.marker, render([], input, this));

        return this;
    }

    shift() {
        let group = this.nodes.shift();

        if (!group) {
            return undefined;
        }

        return remove(group);
    }

    splice(start: number, stop: number = this.nodes.length, ...groups: RenderedGroup[]) {
        return remove(
            ...this.nodes.splice(
                start,
                stop,
                ...after(this.anchor(start), groups)
            )
        );
    }

    unshift(...groups: RenderedGroup[]) {
        return this.nodes.unshift( ...after(this.marker, groups) );
    }
}


const ondisconnect = (element: Element, fn: VoidFunction) => {
    ( element[SLOT_CLEANUP] ??= [] ).push(fn);
};


export default (marker: Element, value: unknown) => {
    return new Slot(marker).render(value);
};
export { ondisconnect, Slot };