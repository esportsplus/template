import { SLOT, SLOT_HTML } from './constants';
import slot, { Slot } from './slot';
import { Element, Renderable } from './types';
import { firstChild, fragment, prepend } from './utilities';


let marker = firstChild.call(fragment(SLOT_HTML));


export default (input: Renderable, parent: HTMLElement | Slot) => {
    if (SLOT in parent) {
        return (parent as Slot).render(input);
    }

    let m = firstChild.call(parent as Element);

    // Comment node
    if (m && m.nodeType === 8) {
    }
    else {
        m = marker.cloneNode() as Element;
    }

    parent.textContent = '';
    prepend.call(parent, m);

    return slot(null, m, input);
};