import { computed, dispose, root } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_REACTIVE, SLOT, SLOT_CLEANUP } from './constants';
import { hydrate } from './html';
import { Element, Elements, RenderableReactive, RenderableTemplate } from './types';
import { firstChild, isArray, isObject, nextSibling, nodeValue, raf, text } from './utilities'
import { isFunction } from '@esportsplus/utilities';


let cleanup: VoidFunction[] = [],
    scheduled = false;


function after(anchor: Element, groups: Elements[]) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i];

        if (group.length) {
            anchor.after(anchor, ...group);
            anchor = group.at(-1)!;
        }
    }

    return groups;
}

function remove(...groups: Elements[]) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i];

        for (let j = 0, o = group.length; j < o; j++) {
            let item = group[j];

            if (item[SLOT_CLEANUP]) {
                cleanup.push(...item[SLOT_CLEANUP]);
            }

            item.remove();
        }
    }

    if (!scheduled && cleanup.length) {
        schedule();
    }

    return groups;
}

function render(anchor: Element | null, input: unknown, slot?: Slot): Elements | Elements[] {
    if (input === false || input == null) {
        input = '';
    }
    else if (typeof input === 'object') {
        if (isArray(input)) {
            let groups: Elements[] = [];

            for (let i = 0, n = input.length; i < n; i++) {
                groups.push( render(null, input[i]) as Elements );
            }

            return anchor ? after(anchor, groups) : groups;
        }

        let nodes: Elements = [];

        if (RENDERABLE in input) {
            if (input[RENDERABLE] === RENDERABLE_REACTIVE) {
                return after(anchor!, hydrate.reactive(input as RenderableReactive, slot!));
            }
            else {
                nodes = hydrate.static(input as RenderableTemplate<unknown>);
            }
        }
        else if (input instanceof NodeList) {
            for (let node = firstChild.call(input as any as Element); node; node = nextSibling.call(node)) {
                nodes.push(node);
            }
        }
        else if (input instanceof Node) {
            nodes = [input] as Elements;
        }

        if (anchor) {
            anchor.after(...nodes);
        }

        return nodes;
    }

    if (input === '') {
        return [];
    }

    let node = text(input as string);

    if (anchor) {
        anchor.after(node);

        if (slot) {
            slot.text = node;
        }
    }

    return [ node ];
}

function schedule() {
    if (scheduled) {
        return;
    }

    scheduled = true;

    raf.add(() => {
        try {
            let fn;

            while (fn = cleanup.pop()) {
                fn();
            }
        }
        catch(e) { }

        scheduled = false;

        if (cleanup.length) {
            schedule();
        }
    });
}


class Slot {
    [SLOT] = null;

    marker: Element;
    nodes: Elements[];
    text: Element | null = null;


    constructor(marker: Element) {
        oncleanup(marker, () => this.clear());

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
        this.text = null;
    }

    pop() {
        let group = this.nodes.pop();

        if (!group) {
            return undefined;
        }

        return remove(group);
    }

    push(...groups: Elements[]) {
        after(this.anchor(), groups);

        for (let i = 0, n = groups.length; i < n; i++) {
            this.nodes.push(groups[i]);
        }

        return this.nodes.length;
    }

    render(input: unknown) {
        if (isFunction(input)) {
            let instance = computed(() => {
                    let v = (input as Function)();

                    if (isFunction(v)) {
                        root(() => this.render(v()));
                    }
                    else {
                        raf.add(() => {
                            this.render(v);
                        });
                    }
                });

            oncleanup(this.marker, () => dispose(instance));

            return this;
        }

        if (this.text) {
            let type = typeof input;

            if (type === 'object' && input !== null) {}
            else if (this.text.isConnected) {
                nodeValue.call(
                    this.text,
                    (type === 'string' || type === 'number') ? input : ''
                );
                return this;
            }
        }

        this.clear();

        if (isArray(input) || (isObject(input) && input[RENDERABLE] === RENDERABLE_REACTIVE)) {
            this.nodes = render(this.marker, input, this) as Elements[];
        }
        else {
            this.nodes = [ render(this.marker, input, this) as Elements ];
        }

        return this;
    }

    shift() {
        let group = this.nodes.shift();

        if (!group) {
            return undefined;
        }

        return remove(group);
    }

    splice(start: number, stop: number = this.nodes.length, ...groups: Elements[]) {
        return remove(
            ...this.nodes.splice(start, stop, ...after(this.anchor(start), groups))
        );
    }

    unshift(...groups: Elements[]) {
        return this.nodes.unshift(...after(this.marker, groups));
    }
}


const oncleanup = (element: Element, fn: VoidFunction) => {
    ( element[SLOT_CLEANUP] ??= [] ).push(fn);
};


export default (marker: Element, value: unknown) => {
    return new Slot(marker).render(value);
};
export { oncleanup, Slot };