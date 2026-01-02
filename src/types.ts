import { ArraySlot } from './slot/array';
import attributes from './attributes';
import slot from './slot';


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

type Renderable<T> = DocumentFragment | ArraySlot<T> | Effect<T> | Node | NodeList | Primitive | Renderable<T>[];

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
        path: (() => ChildNode | null)[];
    }[] | null;
};


export type {
    Attribute, Attributes,
    Effect, Element,
    Renderable,
    SlotGroup,
    Template
};
