import { ArraySlot } from './slot';


// Attribute effects run with the element they are bound to
type Attribute<T extends HTMLElement = HTMLElement> = Callback<[element: T], Primitive | Primitive[]> | ((...args: any[]) => void) | Primitive;

type Attributes<T extends HTMLElement = HTMLElement> = {
    class?: Attribute<T> | Attribute<T>[];
    onconnect?: Callback<[element: T]>;
    ondisconnect?: Callback<[element: T]>;
    onrender?: Callback<[element: T]>;
    ontick?: Callback<[dispose: VoidFunction, element: T]>;
    style?: Attribute<T> | Attribute<T>[];
} & {
    // Elements never fire a DOM resize event; window resizes bind through 'onwindowresize'
    [K in Exclude<keyof GlobalEventHandlersEventMap, 'resize'> as `on${K}` | `once${K}`]?: Handler<T, GlobalEventHandlersEventMap[K]>;
} & {
    [K in keyof DocumentEventMap as `ondocument${K}` | `oncedocument${K}`]?: Handler<T, DocumentEventMap[K]>;
} & {
    [K in keyof WindowEventMap as `onwindow${K}` | `oncewindow${K}`]?: Handler<T, WindowEventMap[K]>;
} & Record<PropertyKey, unknown>;

// Method signatures compare parameters bivariantly, so a listener may annotate a narrower element
type Callback<A extends unknown[], R = void> = { bivariant(...args: A): R }['bivariant'];

// Content effects receive a disposer that tears down their slot
type Effect<T> = (dispose: VoidFunction) => T extends unknown[] ? Renderable<T>[] : Renderable<T>;

type Element<T extends HTMLElement = HTMLElement> = T & Attributes<T>;

type Handler<This, E> = { bivariant(this: This, event: E): void }['bivariant'];

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
