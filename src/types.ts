import { ArraySlot } from './slot';


type Attribute = Effect<Primitive | Primitive[]> | ((...args: any[]) => void) | Primitive;

type Attributes<T extends HTMLElement = Element> = {
    class?: Attribute | Attribute[];
    onconnect?: (element: T) => void;
    ondisconnect?: (element: T) => void;
    onrender?: (element: T) => void;
    ontick?: (dispose: VoidFunction, element: T) => void;
    style?: Attribute | Attribute[];
    [key: `aria-${string}`]: string | number | boolean | undefined;
    [key: `data-${string}`]: string | undefined;
} & {
    [K in keyof GlobalEventHandlersEventMap as `on${string & K}`]?: (this: T, event: GlobalEventHandlersEventMap[K]) => void;
} & Record<PropertyKey, unknown>;

type Effect<T> = () => T extends [] ? Renderable<T>[] : Renderable<T>;

type Element = HTMLElement & Attributes<any>;

// Copied from '@esportsplus/utilities'
// - Importing from ^ causes 'cannot be named without a reference to...' error
type Primitive = bigint | boolean | null | number | string | undefined;

type Renderable<T> = ArraySlot<T> | DocumentFragment | Effect<T> | Node | NodeList | Primitive | Renderable<T>[];

type SlotGroup = {
    head: Element;
    tail: Element;
};


export type {
    Attribute, Attributes,
    Effect, Element,
    Renderable,
    SlotGroup
};
