import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_REACTIVE, RENDERABLE_TEMPLATE } from './constants';
import { firstChild } from './utilities';
import attributes from './attributes';
import event from './event';
import slot from './slot';


type Attributes = {
    class?: string | Effect<Primitive> | (string | Effect<Primitive>)[];
    style?: string | Effect<Primitive> | (string | Effect<Primitive>)[];
} & {
    [K in keyof GlobalEventHandlersEventMap as `on${string & K}`]?: (this: Element, event: GlobalEventHandlersEventMap[K]) => void;
} & {
    [key: `aria-${string}`]: string | number | boolean | undefined;
    [key: `data-${string}`]: string | undefined;
    // Element is mounted to DOM
    // - Trigger animations, etc.
    onmount?: (element: Element) => void;
    // Element is rendered in fragment
    // - Used to retrieve reference to the element
    onrender?: (element: Element) => void;
} & Record<PropertyKey, unknown>;

type Effect<T> = () => EffectResponse<T>;

type EffectResponse<T> = T extends [] ? EffectResponse<T[number]>[] : Primitive | Renderable<T>;

type Element = HTMLElement & Attributes & Record<PropertyKey, unknown>;

type Elements = Element[];

// Copied from '@esportsplus/utilities'
// - Importing from ^ causes 'cannot be named without a reference to...' error
type Primitive = bigint | boolean | null | number | string | undefined;

type Renderable<T = unknown> = RenderableReactive<T> | RenderableTemplate<T>;

type RenderableReactive<T = unknown> = Readonly<{
    [RENDERABLE]: typeof RENDERABLE_REACTIVE;
    literals: null;
    template: (this: ReactiveArray<T>, value: T, i: number) => RenderableTemplate<T>;
    values: ReactiveArray<T>;
}>;

type RenderableTemplate<T> = {
    [RENDERABLE]: typeof RENDERABLE_TEMPLATE;
    literals: TemplateStringsArray;
    template: Template | null;
    values: (RenderableValue<T> | RenderableValue<T>[])[];
};

type RenderableValue<T = unknown> = Attributes | Readonly<Attributes> | Readonly<Attributes[]> | Effect<T> | Primitive | Renderable;

type Template = {
    fragment: DocumentFragment;
    html: string;
    literals: TemplateStringsArray;
    slots: {
        fn: typeof attributes.spread | typeof event | typeof slot;
        path: typeof firstChild[];
        slot: number;
    }[] | null;
};


export type {
    Attributes,
    Effect, Element, Elements,
    Renderable, RenderableReactive, RenderableTemplate, RenderableValue,
    Template
};