import { isInstanceOf } from '@esportsplus/utilities';
import { SLOT_HTML } from './constants';
import slot, { Slot } from './slot';
import { Renderable } from './types';
import { firstChild, fragment, nodeValue, prepend } from './utilities';


let marker = firstChild.call( fragment(SLOT_HTML) ),
    node;


export default (renderable: Renderable, parent: HTMLElement | Slot) => {
    if (isInstanceOf(parent, Slot)) {
        return parent.render(renderable);
    }

    nodeValue.call(parent, '');
    prepend.call(parent, node = marker.cloneNode());

    return slot(node, renderable);
};