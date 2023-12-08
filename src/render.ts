import { SLOT, SLOT_HTML } from './constants';
import slot, { Slot } from './slot';
import { Renderable } from './types';
import { firstChild, fragment, prepend } from './utilities';


let marker = firstChild.call(fragment(SLOT_HTML)),
    node;


export default (renderable: Renderable, parent: HTMLElement | Slot) => {
    if (SLOT in parent) {
        return parent.render(renderable);
    }

    parent.textContent = '';
    prepend.call(parent, node = marker.cloneNode());

    return slot(node, renderable);
};