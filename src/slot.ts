import { effect, root, DIRTY } from '@esportsplus/reactivity';
import { RENDERABLE, SLOT } from './constants';
import { Element, Elements, Renderable } from './types';
import { firstChild, isArray, nextSibling, nodeValue, requestAnimationFrame, text } from './utilities'


function afterGroups(anchor: Element, groups: Elements[]) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i];

        anchor.after(anchor, ...group);
        group.push(anchor = group.pop()!);
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
        if (RENDERABLE in input) {
            let nodes = (input as Renderable).template.render(
                    (input as Renderable).values
                );

            if (anchor) {
                anchor.after(...nodes);
            }

            return nodes;
        }
        else if (isArray(input)) {
            let result: Elements[] = [];

            for (let i = 0, n = input.length; i < n; i++) {
                result.push( render(null, input[i]) as Elements );
            }

            if (anchor) {
                afterGroups(anchor, result);
            }

            return result;
        }
        else if (input instanceof NodeList) {
            let nodes: Elements = [];

            for (let n = firstChild.call(input as any as Element); n; n = nextSibling.call(n)) {
                nodes.push(n);
            }

            if (anchor) {
                anchor.after(...nodes);
            }

            return nodes;
        }
        else if (input instanceof Node) {
            if (anchor) {
                anchor.after(input);
            }

            return [input] as Elements;
        }
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
            nodes.push(node = nodes.pop()!);
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
                    requestAnimationFrame.add(() => {
                        this.render(v);
                    });
                }
            });

            return this;
        }

        if (this.text) {
            if (typeof input === 'object' && input !== null) {
            }
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
            this.nodes = [
                render(this.marker, input, this) as Elements
            ];
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