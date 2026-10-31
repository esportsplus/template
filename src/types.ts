import type { PASSIVE_EVENTS } from './constants';
import { ArraySlot } from './slot';


// Attribute effects run with the element they are bound to
type Attribute<T extends HTMLElement = HTMLElement> = Callback<[element: T], Primitive | Primitive[]> | ((...args: any[]) => void) | Primitive;

type Attributes<T extends HTMLElement = HTMLElement> = {
    class?: Attribute<T> | Attribute<T>[];
    // Not an attribute: listeners bind through onconnect's 'on'
    on?: never;
    // Once, untracked, on the element's first connect; what it binds through 'on' belongs to the element
    onconnect?: Callback<[element: T, on: On]>;
    ondisconnect?: Callback<[element: T]>;
    // Once, in the frame after the one that first paints the element
    onfirstpaint?: Callback<[element: T]>;
    ontick?: Callback<[dispose: VoidFunction, element: T]>;
    style?: StyleAttribute<T> | StyleAttribute<T>[];
} & {
    // Elements never fire a DOM resize event; window resizes bind through 'onwindowresize'
    [K in Exclude<keyof GlobalEventHandlersEventMap, 'resize'> as `on${K}` | `once${K}`]?: Handler<T, GlobalEventHandlersEventMap[K]>;
} & {
    [K in keyof DocumentEventMap as `ondocument${K}` | `oncedocument${K}`]?: Handler<T, DocumentEventMap[K]>;
} & {
    [K in keyof WindowEventMap as `onwindow${K}` | `oncewindow${K}`]?: Handler<T, WindowEventMap[K]>;
} & {
    // Not event keys: a cancelable listener binds through onconnect's 'on' with 'passive: false'
    [K in typeof PASSIVE_EVENTS[number] as `onactive${K}`]?: never;
} & Record<PropertyKey, unknown>;

// Method signatures compare parameters bivariantly, so a listener may annotate a narrower element
type Callback<A extends unknown[], R = void> = { bivariant(...args: A): R }['bivariant'];

// Content effects receive a disposer that tears down their slot
type Effect<T> = (dispose: VoidFunction) => T extends unknown[] ? Renderable<T>[] : Renderable<T>;

type Element<T extends HTMLElement = HTMLElement> = T & Attributes<T>;

type EventOptions = {
    // Listens in the capture phase; never delegated
    capture?: boolean;
    // Attaches to an element target instead of delegating
    direct?: boolean;
    once?: boolean;
    // Defaults to true for PASSIVE_EVENTS, false otherwise
    passive?: boolean;
    signal?: AbortSignal;
};

// Every listener receives a disposer that ends its binding for good
type Handler<This, E> = { bivariant(this: This, event: E, dispose: VoidFunction): void }['bivariant'];

type On = {
    <K extends keyof DocumentEventMap>(target: Document, event: K, listener: Handler<Document, DocumentEventMap[K]>, options?: EventOptions): VoidFunction;
    <K extends keyof WindowEventMap>(target: Window, event: K, listener: Handler<Window, WindowEventMap[K]>, options?: EventOptions): VoidFunction;
    <K extends keyof MediaQueryListEventMap>(target: MediaQueryList, event: K, listener: Handler<MediaQueryList, MediaQueryListEventMap[K]>, options?: EventOptions): VoidFunction;
    <T extends HTMLElement, K extends keyof HTMLElementEventMap>(target: T, event: K, listener: Handler<T, HTMLElementEventMap[K]>, options?: EventOptions): VoidFunction;
    <T extends globalThis.Element, K extends keyof GlobalEventHandlersEventMap>(target: T, event: K, listener: Handler<T, GlobalEventHandlersEventMap[K]>, options?: EventOptions): VoidFunction;
    <T extends EventTarget>(target: T, event: string, listener: Handler<T, Event>, options?: EventOptions): VoidFunction;
};

// Copied from '@esportsplus/utilities'
// - Importing from ^ causes 'cannot be named without a reference to...' error
type Primitive = bigint | boolean | null | number | string | undefined;

type Renderable<T> = ArraySlot<T> | DocumentFragment | Effect<T> | Node | NodeList | Primitive | Renderable<T>[];

type SlotGroup = {
    head: Element;
    tail: Element;
};

// Declarations by property name; a null, undefined, false or empty value leaves the declaration out
type Style = Record<string, Primitive>;

type StyleAttribute<T extends HTMLElement = HTMLElement> =
    Callback<[element: T], Primitive | Style | (Primitive | Style)[]> | ((...args: any[]) => void) | Primitive | Style;


export type {
    Attribute, Attributes,
    Effect, Element, EventOptions,
    Handler,
    On,
    Renderable,
    SlotGroup,
    Style, StyleAttribute
};
