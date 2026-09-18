import { isObject, EMPTY_OBJECT } from '@esportsplus/utilities';
import { Attributes, Element, Renderable } from './types';
import { marker } from './utilities';
import { setProperties } from './attributes';
import slot from './slot';


function render(parent: HTMLElement, attributes: Attributes): void;
function render<T>(parent: HTMLElement, content: Renderable<T>): void;
function render<T>(parent: HTMLElement, attributes: Attributes, content: Renderable<T>): void;
function render<T>(parent: HTMLElement, one?: Attributes | Renderable<T>, two?: Renderable<T>) {
    let anchor = marker.cloneNode() as unknown as Element;

    if (arguments.length === 2 && !isObject(one)) {
        two = one as Renderable<T>;
        one = EMPTY_OBJECT as Attributes;
    }

    parent.append(anchor);

    setProperties(parent as Element, (one || EMPTY_OBJECT) as Attributes);
    slot(anchor, two as Renderable<T>);
}


export default render;