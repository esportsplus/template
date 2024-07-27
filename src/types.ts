import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_INLINE, RENDERABLE_REACTIVE, RENDERABLE_TEMPLATE } from './constants';
import { firstChild } from './utilities';
import attributes from './attributes';
import event from './event';
import slot from './slot';


type Element = HTMLElement & Properties;

type Elements = Element[];

type Properties = Record<PropertyKey, unknown>;

type Renderable<T = unknown> = RenderableReactive<T> | RenderableStatic;

type RenderableInline = {
    [RENDERABLE]: typeof RENDERABLE_INLINE;
    literals: TemplateStringsArray;
    template: Template | null;
    values: unknown[];
};

type RenderableReactive<T = unknown> = {
    [RENDERABLE]: typeof RENDERABLE_REACTIVE;
    literals: null;
    template: (this: ReactiveArray<T>, value: T, i: number) => RenderableStatic;
    values: ReactiveArray<T>;
};

type RenderableStatic = RenderableInline | RenderableTemplate;

type RenderableTemplate = {
    [RENDERABLE]: typeof RENDERABLE_TEMPLATE;
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


export {
    Element, Elements,
    Properties,
    Renderable, RenderableStatic, RenderableInline, RenderableReactive, RenderableTemplate,
    Template
};