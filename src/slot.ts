import { effect, root, DIRTY } from '@esportsplus/reactivity';
import { RENDERABLE, SLOT } from './constants';
import { hydrate } from './html';
import { Element, Elements, Renderable } from './types';
import { firstChild, isArray, nextSibling, nodeValue, raf, text } from './utilities'


let level = 0;


function afterGroups(anchor: Element, groups: Elements[]) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i];

        if (group.length) {
            anchor.after(anchor, ...group);
            anchor = group.at(-1)!;
        }
    }

    return groups;
}

function removeGroup(group?: Elements) {
    if (group === undefined) {
        return group;
    }

    for (let i = 0, n = group.length; i < n; i++) {
        group[i].remove();
    }

    return group;
}

function removeGroups(groups: Elements[]) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i];

        for (let j = 0, o = group.length; j < o; j++) {
            group[j].remove();
        }
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

            level++;

            for (let i = 0, n = input.length; i < n; i++) {
                groups.push( render(null, input[i]) as Elements );
            }

            level--;

            if (anchor) {
                afterGroups(anchor, groups);
            }

            return groups;
        }

        let nodes: Elements = [];

        if (RENDERABLE in input) {
            nodes = hydrate(input as Renderable, level);
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


class Slot {
    [SLOT] = null;

    marker: Element;
    nodes: Elements[];
    text: Element | null = null;


    constructor(marker: Element) {
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
        removeGroups(this.nodes);
        this.text = null;
    }

    pop() {
        return removeGroup(this.nodes.pop());
    }

    push(...groups: Elements[]) {
        afterGroups(this.anchor(), groups);

        for (let i = 0, n = groups.length; i < n; i++) {
            this.nodes.push(groups[i]);
        }

        return this.nodes.length;
    }

    render(input: unknown) {
        if (typeof input === 'function') {
            effect((self) => {
                let v = (input as Function)();

                if (typeof v === 'function') {
                    root(() => {
                        this.render(v());
                    });
                }
                else if (self.state === DIRTY) {
                    this.render(v);
                }
                else {
                    raf.add(() => {
                        this.render(v);
                    });
                }
            });

            return this;
        }

        if (this.text) {
            if (typeof input === 'object' && input !== null) {}
            else if (this.text.isConnected) {
                nodeValue.call(
                    this.text,
                    (typeof input === 'string' || typeof input === 'number') ? input : ''
                );
                return this;
            }
        }

        this.clear();

        if (isArray(input)) {
            this.nodes = render(this.marker, input, this) as Elements[];
        }
        else {
            this.nodes = [ render(this.marker, input, this) as Elements ];
        }

        return this;
    }

    shift() {
        return removeGroup(this.nodes.shift());
    }

    splice(start: number, stop: number = this.nodes.length, ...groups: Elements[]) {
        return removeGroups(
            this.nodes.splice(start, stop, ...afterGroups(this.anchor(start), groups))
        );
    }

    unshift(...groups: Elements[]) {
        return this.nodes.unshift(...afterGroups(this.marker, groups));
    }
}


export default (marker: Element, value: unknown) => {
    if (typeof value === 'function') {
        return (new Slot(marker)).render(value);
    }

    render(marker, value);
};
export { Slot };