import { SLOT_HTML } from './constants';
import { Renderable } from './types';
import { firstChild, fragment, nodeValue } from './utilities';
import slot from './slot';


let anchor,
    marker = firstChild.call( fragment(SLOT_HTML) );


export default (parent: HTMLElement, renderable: Renderable) => {
    // parent.nodeValue = '';
    nodeValue.call(parent, '');
    parent.append(anchor = marker.cloneNode());

    return slot(anchor, renderable);
};