import { SLOT, SLOT_TYPE } from './constants';
import { Element, Elements, Template } from './types';
import slot, { Slot } from './slot';
import attribute from './attribute';
import event from './event';
import renderable from './renderable';


function find(elements: Elements, path: number[], slot: boolean) {
    let total = path.length - 1;

    if (slot && total === 0) {
        return elements[path[0]];
    }

    let element,
        first: keyof Element = 'firstElementChild',
        next: keyof Element = 'nextElementSibling';

    for (let i = 0; i <= total; i++) {
        if (i === 0) {
            element = elements[0];

            if (element.nodeType !== 1) {
                element = element.nextElementSibling;
            }
        }
        else {
            if (i === total && slot) {
                first = 'firstChild';
                next = 'nextSibling';
            }

            element = (element as Element)[first];
        }

        for (let start = 0, stop = path[i]; start < stop; start++) {
            if (element == null) {
                return element;
            }

            element = (element as Element)[next];
        }
    }

    return element as Element | null;
}


export default (input: Template, parent: HTMLElement | Slot) => {
    let s: Slot;

    if (SLOT in parent) {
        s = parent as Slot;
    }
    else {
        s = slot();
        parent.prepend( s.anchor() );
    }

    let { expressions, nodes, slots } = renderable(input);

    s.children = nodes;

    if (slots) {
        for (let i = 0, n = slots.length; i < n; i++) {
            let { path, type } = slots[i],
                node = find(nodes, path, type === SLOT_TYPE);

            if (node == null) {
                throw new Error('Template: invalid node path');
            }

            if (type[0] === 'o' && type[1] === 'n') {
                // @ts-ignore
                event(node, type, expressions[i]);
            }
            else if (type === SLOT_TYPE) {
                // @ts-ignore
                slot(node).render(expressions[i]);
            }
            else {
                // @ts-ignore
                attribute(node, type, expressions[i]);
            }
        }
    }

    return s;
};