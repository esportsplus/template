import { isObject, EMPTY_OBJECT } from '@esportsplus/utilities';
import { Attributes, Element, Renderable } from './types';
import { marker } from './utilities';
import { setProperties } from './attributes';
import slot from './slot';


type A = Attributes;

type C<T> = Renderable<T>;

type E = HTMLElement;


function render(parent: E, attributes: A): void;
function render<T>(parent: E, content: C<T>): void;
function render<T>(parent: E, attributes: A, content: C<T>): void;
function render<T>(parent: E, one?: A | C<T>, two?: C<T>) {
    let anchor = marker.cloneNode() as unknown as Element;

    if (arguments.length === 2 && !isObject(one)) {
        two = one as Renderable<T>;
        one = EMPTY_OBJECT as A;
    }

    parent.append(anchor);

    setProperties(parent as Element, (one || EMPTY_OBJECT) as A);
    slot(anchor, two as Renderable<T>);
}


export default render;