import { SLOT_HTML } from './constants';
import { Renderable } from './types';
import { fragment } from './utilities/fragment';
import { firstChild, nodeValue } from './utilities/node';
import slot from './slot';


let anchor,
    marker = firstChild.call( fragment(SLOT_HTML) );


export default <T>(parent: HTMLElement, renderable: Renderable<T>) => {
    nodeValue.call(parent, '');
    parent.append(anchor = marker.cloneNode());

    slot(anchor, renderable);
};