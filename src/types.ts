import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_REACTIVE, RENDERABLE_TEMPLATE } from './constants';
import { firstChild } from './utilities';
import attributes from './attributes';
import event from './event';
import slot from './slot';


type Attributes = {
    class?: string | Effect | (string | Effect)[],
    style?: string | Effect | (string | Effect)[]
} & {
    [K in keyof GlobalEventHandlersEventMap as `on${string & K}`]?: (event: GlobalEventHandlersEventMap[K]) => void;
} & Record<PropertyKey, unknown>;

type Effect = () => unknown;

type Element = HTMLElement & Attributes;

type Elements = Element[];

type Renderable<T = unknown> = RenderableReactive<T> | RenderableTemplate;

type RenderableReactive<T = unknown> = {
    [RENDERABLE]: typeof RENDERABLE_REACTIVE;
    literals: null;
    template: (this: ReactiveArray<T>, value: T, i: number) => RenderableTemplate;
    values: ReactiveArray<T>;
};

type RenderableTemplate = {
    [RENDERABLE]: typeof RENDERABLE_TEMPLATE;
    literals: TemplateStringsArray;
    template: Template | null;
    values: unknown[];
};

type Template = Readonly<{
    fragment: DocumentFragment;
    html: string;
    literals: TemplateStringsArray;
    slots: {
        fn: typeof attributes.set | typeof attributes.spread | typeof event | typeof slot;
        name: PropertyKey | null;
        path: typeof firstChild[];
        slot: number;
    }[] | null;
}>;


export type {
    Attributes,
    Element, Elements,
    Renderable, RenderableReactive, RenderableTemplate,
    Template
};