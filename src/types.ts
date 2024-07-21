import { RENDERABLE, RENDERABLE_INLINE, RENDERABLE_REACTIVE_TEMPLATE, RENDERABLE_TEMPLATE } from './constants';
import { firstChild } from './utilities';
import attributes from './attributes';
import event from './event';
import slot from './slot';


type Element = HTMLElement & Properties;

type Elements = Element[];

type Properties = Record<PropertyKey, unknown>;

type Renderable<T = any> = {
    [RENDERABLE]: typeof RENDERABLE_INLINE | typeof RENDERABLE_REACTIVE_TEMPLATE | typeof RENDERABLE_TEMPLATE;
    factory?: (this: T[], value: T, i: number) => Renderable;
    literals: TemplateStringsArray;
    template: Template | null;
    values: unknown[];
};

type Template = {
    fragment: DocumentFragment | boolean;
    html: string;
    literals: TemplateStringsArray;
    slots: {
        fn: typeof attributes.set | typeof attributes.spread | typeof event | typeof slot;
        name: PropertyKey | null;
        path: typeof firstChild[];
        slot: number;
    }[] | null;
};


export { Element, Elements, Properties, Renderable, Template };