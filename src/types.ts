import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_HTML_REACTIVE_ARRAY } from './constants';
import { firstChild } from './utilities/node';
import attributes from './attributes';
import slot from './slot';
import html from './html';


type Attribute = Effect<Primitive | Primitive[]> | Primitive;

type Attributes = {
    class?: Attribute | Attribute[];
    style?: Attribute | Attribute[];
} & {
    [K in keyof GlobalEventHandlersEventMap as `on${string & K}`]?: (this: Element, event: GlobalEventHandlersEventMap[K]) => void;
} & {
    [key: `aria-${string}`]: string | number | boolean | undefined;
    [key: `data-${string}`]: string | undefined;
    onconnect?: <T = Element>(element: T) => void;
    ondisconnect?: <T = Element>(element: T) => void;
    onrender?: <T = Element>(element: T) => void;
    ontick?: <T = Element>(element: T) => void;
} & Record<PropertyKey, unknown>;

type Effect<T> = () => T extends [] ? Renderable<T>[] : Renderable<T>;

type Element = HTMLElement & Attributes;

// Copied from '@esportsplus/utilities'
// - Importing from ^ causes 'cannot be named without a reference to...' error
type Primitive = bigint | boolean | null | number | string | undefined;

type Renderable<T> = DocumentFragment | Effect<T> | Node | NodeList | Primitive | RenderableReactive<T> | Renderable<T>[];

type RenderableReactive<T> = Readonly<{
    [RENDERABLE]: typeof RENDERABLE_HTML_REACTIVE_ARRAY;
    array: ReactiveArray<T>;
    template: (
        this: ReactiveArray<T>,
        value: T,
        i: number
    ) => ReturnType<typeof html>;
}>;

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
        path: typeof firstChild[];
        slot: number;
    }[] | null;
};


export type {
    Attributes,
    Effect, Element,
    Renderable, RenderableReactive,
    SlotGroup,
    Template
};