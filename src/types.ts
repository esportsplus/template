import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_HTML_REACTIVE_ARRAY } from './constants';
import { firstChild } from './utilities/node';
import attributes from './attributes';
import slot from './slot';
import html from './html';


type Attribute = Effect<Primitive | Primitive[]> | ((...args: any[]) => void) | Primitive;

type Attributes<T extends HTMLElement = Element> = {
    [key: `aria-${string}`]: string | number | boolean | undefined;
    [key: `data-${string}`]: string | undefined;
    class?: Attribute | Attribute[];
    onconnect?: (element: T) => void;
    ondisconnect?: (element: T) => void;
    onrender?: (element: T) => void;
    ontick?: (dispose: VoidFunction, element: T) => void;
    style?: Attribute | Attribute[];
} & {
    [K in keyof GlobalEventHandlersEventMap as `on${string & K}`]?: (this: T, event: GlobalEventHandlersEventMap[K]) => void;
} & Record<PropertyKey, unknown>;

type Effect<T> = () => T extends [] ? Renderable<T>[] : Renderable<T>;

type Element = HTMLElement & Attributes<any>;

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
        fn: typeof attributes.set | typeof attributes.spread | typeof slot;
        name: string | null;
        path: typeof firstChild[];
    }[] | null;
};


export type {
    Attribute, Attributes,
    Effect, Element,
    Renderable, RenderableReactive,
    SlotGroup,
    Template
};