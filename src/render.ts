import { Element, Renderable } from './types';
import { marker } from './utilities';
import slot from './slot';


export default <T>(parent: HTMLElement, renderable: Renderable<T>) => {
    let anchor = marker.cloneNode() as unknown as Element;

    parent.nodeValue = '';
    parent.append(anchor);

    slot(anchor, renderable);
};
