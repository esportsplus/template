import { SLOT, SLOT_HTML } from './constants';
import slot, { Slot } from './slot';
import { Renderable } from './types';
import { firstChild, fragment, nodeValue, prepend } from './utilities';


let marker = firstChild.call(fragment(SLOT_HTML)),
    node;


export default <T>(renderable: Renderable<T>, parent: HTMLElement | Slot) => {
    if (SLOT in parent) {
        return parent.render(renderable);
    }

    nodeValue.call(parent, '');
    prepend.call(parent, node = marker.cloneNode());

    return slot(node, renderable);
};