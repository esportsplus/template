import { RENDERABLE } from './constants';
import { Template } from './template';


type Element = HTMLElement & Record<PropertyKey, unknown>;

type Elements = Element[];

type Renderable = {
    [RENDERABLE]: null;
    template: Template;
    values: unknown[];
};


export { Element, Elements, Renderable };