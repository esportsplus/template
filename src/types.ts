import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_REACTIVE, RENDERABLE_TEMPLATE } from './constants';
import { firstChild } from './utilities';
import attributes from './attributes';
import slot from './slot';


type Attribute = Primitive | Effect<Primitive | Primitive[]>;

type Attributes = {
    class?: Attribute | Attribute[];
    style?: Attribute | Attribute[];
} & {
    [K in keyof GlobalEventHandlersEventMap as `on${string & K}`]?: (this: Element, event: GlobalEventHandlersEventMap[K]) => void;
} & {
    [key: `aria-${string}`]: string | number | boolean | undefined;
    [key: `data-${string}`]: string | undefined;
    onconnect?: (element: Element) => void;
    ondisconnect?: (element: Element) => void;
    // Rendered in fragment
    // - Used to retrieve reference to the element
    onrender?: (element: Element) => void;
} & Record<PropertyKey, unknown>;

type Effect<T> = () => EffectResponse<T>;

type EffectResponse<T> = T extends [] ? EffectResponse<T[number]>[] : Primitive | Renderable<T>;

type Element = HTMLElement & Attributes & Record<PropertyKey, unknown>;

type Elements = Element[];

type Fragment = DocumentFragment | Node;

// Copied from '@esportsplus/utilities'
// - Importing from ^ causes 'cannot be named without a reference to...' error
type Primitive = bigint | boolean | null | number | string | undefined;

type Renderable<T = unknown> = RenderableReactive<T> | RenderableTemplate<T>;

type RenderableReactive<T = unknown> = Readonly<{
    [RENDERABLE]: typeof RENDERABLE_REACTIVE;
    literals: null;
    template: (
        this: ThisParameterType< Parameters<ReactiveArray<T>['map']>[0] >,
        ...args: Parameters< Parameters<ReactiveArray<T>['map']>[0] >
    ) => RenderableTemplate<T>;
    values: ReactiveArray<T>;
}>;

type RenderableTemplate<T = unknown> = {
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
        fn: typeof attributes.spread | typeof slot;
        path: {
            absolute: typeof firstChild[],
            parent: typeof firstChild[],
            relative: typeof firstChild[]
        };
        slot: number;
    }[] | null;
};


export type {
    Attributes,
    Effect, Element, Elements,
    Fragment,
    Renderable, RenderableReactive, RenderableTemplate, RenderableValue,
    Template
};