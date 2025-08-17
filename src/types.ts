import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_HTML_REACTIVE_ARRAY } from './constants';
import { firstChild } from './utilities/node';
import attributes from './attributes';
import slot from './slot';
import html from './html';


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

type EffectResponse<T> = T extends [] ? (Primitive | Renderable)[] : Primitive | Renderable;

type Element = HTMLElement & Attributes & Record<PropertyKey, unknown>;

// Copied from '@esportsplus/utilities'
// - Importing from ^ causes 'cannot be named without a reference to...' error
type Primitive = bigint | boolean | null | number | string | undefined;

type Renderable = DocumentFragment | Node | NodeList | Primitive | RenderableReactive | Renderable[];

type RenderableReactive = Readonly<{
    [RENDERABLE]: typeof RENDERABLE_HTML_REACTIVE_ARRAY;
    array: ReactiveArray<unknown[]>;
    template: (
        this: ReactiveArray<unknown[]>,
        ...args: Parameters< Parameters<ReactiveArray<unknown[]>['map']>[0] >
    ) => ReturnType<typeof html>;
}>;

type RenderableValue<T = unknown> = Attributes | Readonly<Attributes> | Readonly<Attributes[]> | Effect<T> | Primitive | RenderableReactive;

type SlotGroup = {
    head: Element;
    tail: Element;
};

type Template = {
    fragment: DocumentFragment;
    html: string;
    literals: TemplateStringsArray;
    slots: {
        fn: typeof attributes.spread | typeof slot;
        // @see ./html/index.ts comments
        path: typeof firstChild[];
        // path: {
        //     absolute: typeof firstChild[],
        //     parent: typeof firstChild[],
        //     relative: typeof firstChild[]
        // };
        slot: number;
    }[] | null;
};


export type {
    Attributes,
    Effect, Element,
    Renderable, RenderableReactive, RenderableValue,
    SlotGroup,
    Template
};