import { TEMPLATE } from './constants';


type Element = HTMLElement & Record<PropertyKey, unknown>;

type Elements = Element[];

type Template = {
    [TEMPLATE]: boolean;
    expressions?: unknown[];
    html: string;
    slots?: {
        path: number[];
        type: string;
    }[];
};


export { Element, Elements, Template };