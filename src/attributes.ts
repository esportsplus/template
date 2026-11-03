import { effect } from '@esportsplus/reactivity';
import { isArray, isObject } from '@esportsplus/utilities';
import { ATTRIBUTE_DELIMITERS, STORE } from './constants';
import { Attributes, Element } from './types';
import { runtime } from './event';
import { context as current, stale, unowned } from './slot/cleanup';
import type { Slot } from './slot/cleanup';


// The first runs of a merged call's parts record their tokens here instead of writing, so the call writes once
type Batch = {
    changed: boolean;
    open: boolean;
};

type Context = {
    cold?: Record<number, Record<PropertyKey, true>>;
    effect?: number,
    element: Element;
    raw?: unknown[];
    store?: Record<string, unknown>;
    values?: Record<string, unknown>;
};

type ListState = {
    dynamic: Set<string>;
    static: string;
};


function apply(element: Element, name: string, value: unknown) {
    if (name === 'class') {
        // An SVG element's className is a read-only SVGAnimatedString
        if (svg(element)) {
            element.setAttribute('class', value as string);
        }
        else {
            element.className = value as string;
        }
    }
    else if (name === 'style') {
        element.style.cssText = value as string;
    }
    else if (attribute(name, element)) {
        if (value == null || value === false || value === '') {
            element.removeAttribute(name);
        }
        else {
            element.setAttribute(name, value as string);
        }
    }
    else {
        element[name] = value == null || value === false
            ? (typeof element[name] === 'boolean' ? false : '')
            : value;
    }
}

function attribute(name: string, element: Element) {
    return name.indexOf('-') !== -1 || svg(element) || !(name in element);
}

// Every part a class or style value names: a string split on the list's delimiter, an array entry by
// entry, and a style object's entries as declarations. Null, undefined, false and empty values name
// nothing, so a style object keeps one shape and drops a declaration by leaving it undefined.
function collect(name: string, delimiter: string, value: unknown, into: string[]) {
    if (value == null || value === false || value === '') {
        return;
    }

    if (typeof value === 'string') {
        let parts = value.split(delimiter);

        for (let i = 0, n = parts.length; i < n; i++) {
            let part = parts[i].trim();

            if (part !== '') {
                into.push(part);
            }
        }
    }
    else if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            collect(name, delimiter, value[i], into);
        }
    }
    else if (name === 'style' && isObject(value)) {
        for (let key in value) {
            let declaration = (value as Record<string, unknown>)[key];

            if (typeof declaration === 'number' || (typeof declaration === 'string' && declaration !== '')) {
                into.push(`${key}: ${declaration}`);
            }
        }
    }
}

function context(element: Element) {
    return (element[STORE] ??= { element }) as Context;
}

function empty(value: unknown) {
    return value == null || value === false || value === '';
}

function join(state: ListState, delimiter: string) {
    let joined = state.static;

    for (let key of state.dynamic) {
        joined += (joined ? delimiter : '') + key;
    }

    return joined;
}

// Whether 'value' changes the element's list. A static value (id null) appends to the list's static part.
function list(ctx: Context, element: Element, id: null | number, name: string, value: unknown) {
    if (empty(value)) {
        value = '';
    }

    let changed = false,
        delimiter = ATTRIBUTE_DELIMITERS[name],
        listState = state(ctx, element, name);

    if (id === null) {
        let parts: string[] = [];

        collect(name, delimiter, value, parts);

        for (let i = 0, n = parts.length; i < n; i++) {
            changed = true;
            listState.static += (listState.static ? delimiter : '') + parts[i];
        }
    }
    // An array or object is diffed whole each run: it may be the same instance with new contents
    else if (typeof value === 'object' || (ctx.raw ??= [])[id] !== value) {
        let dynamic = listState.dynamic,
            hot: Record<PropertyKey, true> = {},
            parts: string[] = [];

        collect(name, delimiter, value, parts);

        for (let i = 0, n = parts.length; i < n; i++) {
            let part = parts[i];

            if (!dynamic.has(part)) {
                changed = true;
                dynamic.add(part);
            }

            hot[part] = true;
        }

        let cold = (ctx.cold ??= {})[id];

        if (cold !== undefined) {
            for (let part in cold) {
                if (hot[part] === true) {
                    continue;
                }

                changed = true;
                dynamic.delete(part);
            }
        }

        (ctx.raw ??= [])[id] = value;
        ctx.cold[id] = hot;
    }

    return changed;
}

// Binds each part of a merged call: functions get their own effect, arrays bind entry by entry, anything
// else joins the static list. Returns whether a static part changed the list.
function merge(ctx: Context, element: Element, name: string, value: unknown, batch: Batch): boolean {
    if (empty(value)) {
        return false;
    }

    if (typeof value === 'function') {
        reactive(ctx, element, name, value, batch);

        return false;
    }

    if (isArray(value)) {
        let changed = false;

        for (let i = 0, n = value.length; i < n; i++) {
            changed = merge(ctx, element, name, value[i], batch) || changed;
        }

        return changed;
    }

    return list(ctx, element, null, name, value);
}

// The value to write once 'value' changes the binding, undefined while it stays as it is.
function property(ctx: Context | null, element: Element, id: null | number, name: string, value: unknown) {
    if (empty(value)) {
        value = '';
    }

    if (id !== null) {
        ctx ??= context(element);

        let values = ctx.values ??= {};

        if (values[name] === value) {
            return undefined;
        }

        values[name] = value;
    }

    return value;
}

// Written as the effect runs: reactivity already defers reruns to a microtask, so the DOM lands in
// the same task as the change, and its flush() makes it synchronous.
function reactive(ctx: Context, element: Element, name: string, value: unknown, batch: Batch | null) {
    let lists = name === 'class' || name === 'style',
        mounted = false,
        parent = current(),
        slot: Slot | null = null,
        stop: VoidFunction;

    ctx.effect ??= 0;

    let id = ctx.effect++;

    stop = effect(() => {
        if (element.isConnected) {
            mounted = true;
        }
        // Out of the document after being seen in it: idle until the end of the task tells a move from a removal
        else if (mounted) {
            stale(slot ??= { anchor: element, disposed: false, parent, release: stop, state: 0 });
            return;
        }

        let v = (value as Function)(element);

        // A class or style list takes a returned array or style object whole, as one diff and one write
        if (lists) {
            if (!list(ctx, element, id, name, v)) {
                return;
            }

            if (batch !== null && batch.open) {
                batch.changed = true;
            }
            else {
                apply(element, name, join(ctx.store![name] as ListState, ATTRIBUTE_DELIMITERS[name]));
            }

            return;
        }

        // A plain attribute has no object form
        if (v != null && typeof v === 'object') {
            return;
        }

        let next = property(ctx, element, id, name, v);

        if (next !== undefined) {
            apply(element, name, next);
        }
    });

    unowned(element, stop);
}

function state(ctx: Context, element: Element, name: string) {
    let store = ctx.store ??= {},
        listState = store[name] as ListState | undefined;

    if (!listState) {
        let delimiter = ATTRIBUTE_DELIMITERS[name],
            seed = (element.getAttribute(name) || '').trim();

        // A browser-serialised cssText ends in ';', which would join as ';;'
        if (seed.endsWith(delimiter)) {
            seed = seed.slice(0, -1).trimEnd();
        }

        listState = { dynamic: new Set(), static: seed };
        store[name] = listState;
    }

    return listState;
}

// Every SVG element carries ownerSVGElement, null on an outermost <svg>; HTML elements have none
function svg(element: Element) {
    return element['ownerSVGElement'] !== undefined;
}

// The compiled form of an element's class or style: one call for every writer the template has.
// 'parts[0]' is the element's static list, trimmed and joined by the compiler and absent from the clone,
// so a list this call creates is seeded with it as is, without reading the attribute.
function write(element: Element, name: 'class' | 'style', parts: unknown[]) {
    let n = parts.length,
        seed = parts[0] as string;

    if (seed === '') {
        let i = 1;

        while (i < n && empty(parts[i])) {
            i++;
        }

        if (i === n) {
            return;
        }
    }

    let batch: Batch = { changed: false, open: true },
        changed = false,
        ctx = context(element),
        store = ctx.store ??= {};

    if (store[name] === undefined) {
        store[name] = { dynamic: new Set(), static: seed } satisfies ListState;
        changed = seed !== '';
    }
    else if (seed !== '') {
        changed = list(ctx, element, null, name, seed);
    }

    for (let i = 1; i < n; i++) {
        changed = merge(ctx, element, name, parts[i], batch) || changed;
    }

    batch.open = false;

    if (changed || batch.changed) {
        apply(element, name, join(store[name] as ListState, ATTRIBUTE_DELIMITERS[name]));
    }
}


const setClass = (element: Element, parts: unknown[]) => {
    write(element, 'class', parts);
};

const setList = (element: Element, name: 'class' | 'style', value: unknown) => {
    if (typeof value === 'function') {
        reactive(context(element), element, name, value, null);
    }
    // A static array can hold functions, so each entry binds on its own
    else if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            let v = value[i];

            if (empty(v)) {
                continue;
            }

            setList(element, name, v);
        }
    }
    else {
        let ctx = context(element);

        if (list(ctx, element, null, name, value)) {
            apply(element, name, join(ctx.store![name] as ListState, ATTRIBUTE_DELIMITERS[name]));
        }
    }
};

const setProperty = (element: Element, name: string, value: unknown) => {
    if (typeof value === 'function') {
        reactive(context(element), element, name, value, null);
    }
    else {
        apply(element, name, property(null, element, null, name, value));
    }
};

// 'merged' skips class and style: the compiled setClass/setStyle call of the element already took them
const setProperties = function (
    element: Element,
    properties: Attributes | Attributes[] | false | null | undefined,
    merged: boolean = false
) {
    if (!properties) {
        return;
    }
    else if (isObject(properties)) {
        for (let name in properties) {
            let value = properties[name];

            if (empty(value)) {
                continue;
            }

            if (name === 'class' || name === 'style') {
                if (!merged) {
                    setList(element, name, value);
                }
            }
            else if (typeof value === 'function') {
                if (name[0] === 'o' && name[1] === 'n') {
                    runtime(element, name as `on${string}`, value as Function);
                }
                else {
                    reactive(context(element), element, name, value, null);
                }
            }
            else  {
                apply(element, name, property(null, element, null, name, value));
            }
        }
    }
    else if (isArray(properties)) {
        for (let i = 0, n = properties.length; i < n; i++) {
            setProperties(element, properties[i]);
        }
    }
};

const setStyle = (element: Element, parts: unknown[]) => {
    write(element, 'style', parts);
};


// Called only for composed values. Standalone slots keep setList/setProperty's
// native boolean/array semantics. Expression factories have already run once.
const interpolate = (parts: unknown[]): string | ((element: Element) => string) => {
    let callbacks = parts.map(part => typeof part === 'function');

    const join = (element?: Element) => {
        let result = '';

        for (let i = 0; i < parts.length; i++) {
            let value = callbacks[i] ? (parts[i] as Function)(element) : parts[i];

            if (value != null && value !== false) {
                result += String(value);
            }
        }

        return result;
    };

    return callbacks.some(Boolean) ? join : join();
};

export { interpolate, setClass, setList, setProperty, setProperties, setStyle };
