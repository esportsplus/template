import { ArraySlot } from './slot';


type Attribute = Effect<Primitive | Primitive[]> | ((...args: any[]) => void) | Primitive;

type Attributes<T extends HTMLElement = HTMLElement> = {
    class?: Attribute | Attribute[];
    onconnect?: Callback<[element: T]>;
    ondisconnect?: Callback<[element: T]>;
    onrender?: Callback<[element: T]>;
    ontick?: Callback<[dispose: VoidFunction, element: T]>;
    style?: Attribute | Attribute[];
    [key: `aria-${string}`]: Property<T, Primitive>;
    [key: `data-${string}`]: Property<T, Primitive>;
} & {
    [K in keyof Properties<T>]?: Property<T, Properties<T>[K] | false | null | undefined>;
} & {
    // Elements never fire a DOM resize event; window resizes bind through 'onwindowresize'
    [K in Exclude<keyof GlobalEventHandlersEventMap, 'resize'> as `on${K}` | `once${K}`]?: Handler<T, GlobalEventHandlersEventMap[K]>;
} & {
    [K in keyof DocumentEventMap as `ondocument${K}` | `oncedocument${K}`]?: Handler<Document, DocumentEventMap[K]>;
} & {
    [K in keyof WindowEventMap as `onwindow${K}` | `oncewindow${K}`]?: Handler<Window, WindowEventMap[K]>;
} & Record<PropertyKey, unknown>;

// Method signatures compare parameters bivariantly, so a listener may annotate a narrower element
type Callback<A extends unknown[], R = void> = { bivariant(...args: A): R }['bivariant'];

type Effect<T> = () => T extends unknown[] ? Renderable<T>[] : Renderable<T>;

type Element<T extends HTMLElement = HTMLElement> = T & Attributes<T>;

type Equals<A, B> = (<V>() => V extends A ? 1 : 2) extends (<V>() => V extends B ? 1 : 2) ? true : false;

type Handler<This, E> = { bivariant(this: This, event: E): void }['bivariant'];

type Merge<U> = {
    [K in U extends unknown ? keyof U : never]: U extends unknown ? (K extends keyof U ? U[K] : never) : never;
};

type Mutable<E> = {
    [K in MutableKeys<E>]: E[K];
};

// The readonly probe must run before any conditional on K: distributing over K drops its modifiers.
// Index signatures ('HTMLFormElement[name: string]: any') would widen every merged property to 'any'.
type MutableKeys<E> = {
    [K in keyof E]-?: Equals<{ [Q in K]: E[K] }, { -readonly [Q in K]: E[K] }> extends true
        ? K extends string
            ? string extends K
                ? never
                : NonNullable<E[K]> extends Primitive ? K : never
            : never
        : never;
}[keyof E];

// Template attributes cannot name their element, so the unnarrowed form offers every element's properties
type Mutables = Merge<HTMLElementTagNameMap[keyof HTMLElementTagNameMap] extends infer E ? E extends unknown ? Mutable<E> : never : never>;

// Copied from '@esportsplus/utilities'
// - Importing from ^ causes 'cannot be named without a reference to...' error
type Primitive = bigint | boolean | null | number | string | undefined;

type Properties<T extends HTMLElement> = HTMLElement extends T ? Mutables : Mutable<T>;

type Property<T, V> = Callback<[element: T], V> | V;

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
