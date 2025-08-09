import { effect, root } from '@esportsplus/reactivity';
import { isArray, isFunction, isInstanceOf, isObject  } from '@esportsplus/utilities';
import { RENDERABLE, RENDERABLE_REACTIVE } from './constants';
import { hydrate } from './html';
import { Element, Elements, HydrateResult, RenderableReactive, RenderableTemplate } from './types';
import { append, cloneNode, firstChild, fragment, microtask, nextSibling, nodeValue, raf, text } from './utilities'
import queue from '@esportsplus/queue';


const CLEANUP_KEY = Symbol();


let cleanup = queue<VoidFunction[]>(64),
    scheduled = false,
    template = fragment('');


function after(anchor: Element, groups: HydrateResult[]) {
    let n = groups.length;

    if (n === 0) {
        return [];
    }

    let elements: Elements[] = [],
        fragment = groups[0].fragment || cloneNode.call(template);

    if (n === 1) {
        elements.push( groups[0].elements );
    }
    else {
        for (let i = 1; i < n; i++) {
            let { elements: e, fragment: f } = groups[i];

            append.call(fragment, f);
            elements.push(e);
        }
    }

    anchor.after(fragment);

    return elements;
}

function remove(...groups: Elements[]) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i];

        for (let j = 0, o = group.length; j < o; j++) {
            let item = group[j];

            if (CLEANUP_KEY in item) {
                cleanup.add(item[CLEANUP_KEY] as VoidFunction[]);
            }

            item.remove();
        }
    }

    if (!scheduled && cleanup.length) {
        schedule();
    }

    return groups;
}

function render(elements: Elements[], fragment: DocumentFragment | Node, input: unknown, slot?: Slot) {
    if (input === false || input == null || input === '') {
        return;
    }

    if (isArray(input)) {
        for (let i = 0, n = input.length; i < n; i++) {
            render(elements, fragment, input[i]);
        }
    }
    else if (isObject(input) && RENDERABLE in input) {
        if (input[RENDERABLE] === RENDERABLE_REACTIVE) {
            let response = hydrate.reactive(input as RenderableReactive, slot!);

            for (let i = 0, n = response.length; i < n; i++) {
                let { elements: e, fragment: f } = response[i];

                append.call(fragment, f);
                elements.push(e);
            }
        }
        else {
            let { elements: e, fragment: f } = hydrate.static(input as RenderableTemplate<unknown>);

            append.call(fragment, f);
            elements.push(e);
        }
    }
    else if (isInstanceOf(input, NodeList)) {
        let e: Elements = [];

        for (let node = firstChild.call(input); node; node = nextSibling.call(node)) {
            e.push(node);
        }

        append.call(fragment, ...e);
        elements.push(e);
    }
    else if (isInstanceOf(input, Node)) {
        append.call(fragment, input);
        elements.push([ input as Element ]);
    }
    else {
        let element = text( typeof input === 'string' ? input : String(input) );

        if (slot) {
            slot.text = element;
        }

        append.call(fragment, element);
        elements.push([ element ]);
    }
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
            node = nodes[nodes.length - 1];
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

    push(...groups: HydrateResult[]) {
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

        let fragment = cloneNode.call(template),
            nodes: Elements[] = [];

        render(nodes, fragment, input, this);

        this.marker.after(fragment);
        this.nodes = nodes;

        return this;
    }

    shift() {
        let group = this.nodes.shift();

        if (!group) {
            return undefined;
        }

        return remove(group);
    }

    splice(start: number, stop: number = this.nodes.length, ...groups: HydrateResult[]) {
        return remove(
            ...this.nodes.splice(
                start,
                stop,
                ...after(this.anchor(start), groups)
            )
        );
    }

    unshift(...groups: HydrateResult[]) {
        return this.nodes.unshift( ...after(this.marker, groups) );
    }
}


const ondisconnect = (element: Element, fn: VoidFunction) => {
    ((element[CLEANUP_KEY] ??= []) as VoidFunction[]).push(fn);
};


export default (marker: Element, value: unknown) => {
    return new Slot(marker).render(value);
};
export { ondisconnect, Slot };