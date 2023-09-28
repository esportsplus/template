import { effect, root, DIRTY } from '@esportsplus/reactivity';
import { SLOT, SLOT_HTML, TEMPLATE } from './constants';
import { Element, Elements, Template } from './types';
import { isArray, toString } from '~/utilities';
import html from './html';
import raf from './raf';
import render from './render';
import renderable from './renderable';


let slot = renderable( html.const(SLOT_HTML) ),
    text = document.createTextNode('');


function after(anchor: Element, elements: Elements) {
    anchor.after(...elements);
    return elements;
}

function afterGroups(anchor: Element, groups: Elements[]) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i];

        anchor.after(...group);
        anchor = group[group.length - 1];
    }

    return groups;
}

function remove(elements?: Elements) {
    if (elements === undefined) {
        return elements;
    }

    for (let i = 0, n = elements.length; i < n; i++) {
        elements[i].remove();
    }

    return elements;
}

function removeGroups(groups: Elements[]) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let elements = groups[i];

        for (let j = 0, o = elements.length; j < o; j++) {
            elements[j].remove();
        }
    }

    return groups;
}


class Slot {
    marker: Element;
    nodes: Elements[] = [];
    text: Element | null = null;
    value: string | null = null;


    constructor(anchor?: Element) {
        this.marker = anchor || slot.nodes[0];
    }


    get [SLOT]() {
        return true;
    }

    get length() {
        return this.nodes.length;
    }

    set children(groups: Elements) {
        removeGroups(this.nodes);

        this.nodes = [
            after(this.marker, groups)
        ];
    }

    set length(n: number) {
        this.splice(n);
    }


    anchor(index: number = this.nodes.length - 1) {
        let node,
            nodes = this.nodes[index];

        if (nodes) {
            node = nodes[ nodes.length - 1 ];
        }

        return node || this.marker;
    }

    pop() {
        return remove( this.nodes.pop() );
    }

    push(...groups: Elements[]) {
        afterGroups(this.anchor(), groups);

        for (let i = 0, n = groups.length; i < n; i++) {
            this.nodes.push( groups[i] );
        }

        return this.nodes.length;
    }

    render(value: unknown) {
        if (value == null) {
        }
        else if (typeof value === 'function') {
            effect((self) => {
                let v = (value as Function)();

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
        else if (typeof value === 'object') {
            this.text = null;
            this.value = null;

            if (TEMPLATE in value) {
                render(value as Template, this);
            }
            else if (isArray(value)) {
                render(html.slot(value), this);
            }
            // instanceof is slow...
            else if (value instanceof NodeList) {
                this.children = Array.from(value) as Elements;
            }
            else if (value instanceof Node) {
                this.children = [ value ] as Elements;
            }
            else {
                throw new Error(`Template: renderable objects must be an array, node, nodelist, or template ${JSON.stringify(value)}`);
            }

            return this;
        }

        value = toString(value);

        if (this.value !== value) {
            this.value = value as string;

            if (this.text === null) {
                this.text = text.cloneNode(true) as Element;
                this.text.nodeValue = this.value;

                this.children = [ this.text ];
            }
            else {
                this.text.nodeValue = this.value;
            }
        }

        return this;
    }

    shift() {
        return remove( this.nodes.shift() );
    }

    splice(start: number, deleteCount: number = this.nodes.length, ...groups: Elements[]) {
        return removeGroups(
            this.nodes.splice(start, deleteCount, ...afterGroups(this.anchor(start), groups))
        );
    }

    unshift(...groups: Elements[]) {
        return this.nodes.unshift( ...afterGroups(this.marker, groups) );
    }
}


export default (anchor?: Element) => {
    return new Slot(anchor);
};
export { Slot };