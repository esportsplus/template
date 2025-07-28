import { ReactiveArray } from '@esportsplus/reactivity';
import { Primitive } from '@esportsplus/utilities';
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
} & Record<PropertyKey, unknown>;

type Effect<T> = () => EffectResponse<T>;

type EffectResponse<T> = T extends [] ? EffectResponse<T[number]>[] : Primitive | Renderable<T>;

type Element = HTMLElement & Attributes & Record<PropertyKey, unknown>;

type Elements = Element[];

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
    values: RenderableValue<T>[];
};

type RenderableValue<T = unknown> =
    Attributes | Attributes[] |
    Readonly<Attributes> | Readonly<Attributes[]> |
    Effect<T> | Effect<T>[] |
    Primitive | Primitive[] |
    Renderable | Renderable[];

type Template = {
    fragment: DocumentFragment;
    html: string;
    literals: TemplateStringsArray;
    slots: {
        fn: typeof attributes.set | typeof attributes.spread | typeof event | typeof slot;
        name: PropertyKey | null;
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