import { effect } from '@esportsplus/reactivity';
import { isArray, isInstanceOf } from '@esportsplus/utilities';
import { EMPTY_FRAGMENT, RENDERABLE, RENDERABLE_REACTIVE } from './constants';
import { hydrate } from './html';
import { Element, Elements, Fragment, RenderableReactive, RenderableTemplate } from './types';
import { append, cloneNode, microtask, nodeValue, raf, text } from './utilities'
import queue from '@esportsplus/queue';


const CLEANUP_KEY = Symbol();

const CONNECTED = 0;

const HYDRATING = 1;


let cleanup = queue<VoidFunction[]>(64),
    scheduled = false;


function remove(groups: Elements[]) {
    let group,
        item;

    while (group = groups.pop()) {
        while (item = group.pop()) {
            if (CLEANUP_KEY in item) {
                cleanup.add(item[CLEANUP_KEY] as VoidFunction[]);
                item[CLEANUP_KEY] = null;
            }

            item.remove();
        }
    }

    if (!scheduled && cleanup.length) {
        schedule();
    }
}

function render(anchor: Element, elements: Elements[] | null, fragment: Fragment, input: unknown, slot?: Slot) {
    if (input === false || input == null || input === '') {
        return;
    }

    let type = typeof input;

    if (type === 'object' && RENDERABLE in (input as Record<PropertyKey, unknown>)) {
        if ((input as Record<PropertyKey, unknown>)[RENDERABLE] === RENDERABLE_REACTIVE) {
            slot ??= new Slot(anchor);
            hydrate.reactive(slot.nodes, fragment, input as RenderableReactive, slot);
        }
        else {
            hydrate.static(elements, fragment, input as RenderableTemplate);
        }
    }
    else if (type === 'string' || type === 'number') {
        let element = text( type === 'string' ? input as string : String(input) );

        if (slot) {
            slot.text = element;
        }

        append.call(fragment, element);

        if (elements) {
            elements.push([element]);
        }
    }
    else if (isArray(input)) {
        for (let i = 0, n = input.length; i < n; i++) {
            render(anchor, elements, fragment, input[i], slot);
        }
    }
    else if (isInstanceOf(input, NodeList)) {
        append.call(fragment, ...input);

        if (elements) {
            elements.push([...input] as Elements);
        }
    }
    else if (isInstanceOf(input, Node)) {
        append.call(fragment, input);

        if (elements) {
            elements.push([ input as Element ]);
        }
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
        if (n >= this.nodes.length) {
            return;
        }
        else if (n === 0) {
            this.clear();
        }
        else {
            this.splice(n);
        }
    }


    anchor(index: number = this.nodes.length - 1) {
        let nodes = this.nodes[index];

        return nodes ? nodes[nodes.length - 1] : this.marker;
    }

    clear() {
        if (this.text) {
            this.nodes.push([this.text]);
            this.text = null;
        }

        remove(this.nodes);

        return this;
    }

    pop() {
        let group = this.nodes.pop();

        if (group) {
            remove([group]);
        }

        return this;
    }

    push(fragment: Fragment, ...nodes: Elements[]) {
        this.anchor().after(fragment);
        this.nodes.push( ...nodes );

        return this;
    }

    render(input: unknown, state = HYDRATING) {
        let type = typeof input;

        if (type === 'function') {
            ondisconnect(
                this.marker,
                effect(() => {
                    let v = (input as Function)();

                    if (state === HYDRATING) {
                        this.render(v, state);
                        state = CONNECTED;
                    }
                    else if (state === CONNECTED) {
                        raf.add(() => {
                            this.render(v, state);
                        });
                    }
                })
            );

            return this;
        }

        let text = this.text;

        if (text && text.isConnected && (input == null || type !== 'object')) {
            nodeValue.call(text, (type === 'number' || type === 'string') ? input : '');
        }
        else {
            this.clear();

            let fragment = cloneNode.call(EMPTY_FRAGMENT);

            render(this.marker, this.nodes, fragment, input, this);

            this.marker.after(fragment);
        }

        return this;
    }

    shift() {
        let group = this.nodes.shift();

        if (group) {
            remove([group]);
        }

        return this;
    }

    splice(start: number, stop: number = this.nodes.length, fragment?: Fragment, ...nodes: Elements[]) {
        if (!fragment) {
            remove( this.nodes.splice(start, stop) );
        }
        else {
            this.anchor(start).after(fragment);
            remove( this.nodes.splice(start, stop, ...nodes) )
        }

        return this;
    }

    unshift(fragment: Fragment, ...nodes: Elements[]) {
        this.marker.after(fragment);
        this.nodes.unshift( ...nodes );

        return this;
    }
}


const ondisconnect = (element: Element, fn: VoidFunction) => {
    ((element[CLEANUP_KEY] ??= []) as VoidFunction[]).push(fn);
};


export default (marker: Element, value: unknown) => {
    let type = typeof value;

    if (type === 'function') {
        new Slot(marker).render(value);
    }
    else {
        let fragment = cloneNode.call(EMPTY_FRAGMENT);

        render(marker, null, fragment, value);

        marker.after(fragment);
    };
};
export { ondisconnect, Slot };