import { Renderable } from './types';
import { nodeValue } from './utilities/node';
import marker from './utilities/marker';
import slot from './slot';


export default <T>(parent: HTMLElement, renderable: Renderable<T>) => {
    let anchor = marker.cloneNode();

    nodeValue.call(parent, '');
    parent.append(anchor);

    slot(anchor, renderable);
};