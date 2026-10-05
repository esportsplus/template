import { effect } from '@esportsplus/reactivity';
import { isArray, isObject } from '@esportsplus/utilities';
import { ATTRIBUTE_DELIMITERS, STORE } from './constants';
import { Attributes, Element } from './types';
import { runtime } from './event';
import { context as current, stale, unowned } from './slot/cleanup';
import type { Slot } from './slot/cleanup';


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
        element.className = value as string;
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
    return name.indexOf('-') !== -1 || element['ownerSVGElement'] != null || !(name in element);
}

function context(element: Element) {
    return (element[STORE] ??= { element }) as Context;
}

// The element's full list once 'value' changes it, undefined while it stays as it is.
function list(ctx: Context | null, element: Element, id: null | number, name: string, value: unknown) {
    if (value == null || value === false || value === '') {
        value = '';
    }

    let changed = false,
        delimiter = ATTRIBUTE_DELIMITERS[name],
        store = (ctx ??= context(element)).store ??= {},
        listState = store[name] as ListState | undefined;

    if (!listState) {
        listState = {
            dynamic: new Set(),
            static: (element.getAttribute(name) || '').trim()
        };
        store[name] = listState;
    }

    let dynamic = listState.dynamic;

    if (id === null) {
        if (value && typeof value === 'string') {
            changed = true;
            listState.static += (listState.static ? delimiter : '') + value;
        }
    }
    else if ((ctx.raw ??= [])[id] !== value) {
        let hot: Record<PropertyKey, true> = {};

        if (value && typeof value === 'string') {
            let part: string | undefined,
                parts = (value as string).split(delimiter);

            while ((part = parts.pop()) !== undefined) {
                part = part.trim();

                if (part === '') {
                    continue;
                }

                if (!dynamic.has(part)) {
                    changed = true;
                    dynamic.add(part);
                }

                hot[part] = true;
            }
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

        ctx.raw[id] = value;
        ctx.cold[id] = hot;
    }

    if (!changed) {
        return undefined;
    }

    let joined = listState.static;

    for (let key of dynamic) {
        joined += (joined ? delimiter : '') + key;
    }

    return joined;
}

// The value to write once 'value' changes the binding, undefined while it stays as it is.
function property(ctx: Context | null, element: Element, id: null | number, name: string, value: unknown) {
    if (value == null || value === false || value === '') {
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
function reactive(element: Element, name: string, value: unknown) {
    let ctx = context(element),
        fn = (name === 'class' || name === 'style') ? list : property,
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

        let next: unknown,
            v = (value as Function)(element);

        if (v == null || typeof v !== 'object') {
            next = fn(ctx, element, id, name, v);
        }
        else if (isArray(v)) {
            // One write for the whole array, whichever of its values changed.
            for (let i = 0, n = v.length; i < n; i++) {
                let part = fn(ctx, element, id, name, v[i]);

                if (part !== undefined) {
                    next = part;
                }
            }
        }

        if (next !== undefined) {
            apply(element, name, next);
        }
    });

    unowned(element, stop);
}


const setList = (element: Element, name: 'class' | 'style', value: unknown) => {
    if (typeof value === 'function') {
        reactive(element, name, value);
    }
    else if (typeof value !== 'object') {
        let next = list(null, element, null, name, value);

        if (next !== undefined) {
            apply(element, name, next);
        }
    }
    else if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            let v = value[i];

            if (v == null || v === false || v === '') {
                continue;
            }

            setList(element, name, v);
        }
    }
};

const setProperty = (element: Element, name: string, value: unknown) => {
    if (typeof value === 'function') {
        reactive(element, name, value);
    }
    else {
        apply(element, name, property(null, element, null, name, value));
    }
};

const setProperties = function (
    element: Element,
    properties: Attributes | Attributes[] | false | null | undefined
) {
    if (!properties) {
        return;
    }
    else if (isObject(properties)) {
        for (let name in properties) {
            let value = properties[name];

            if (value == null || value === false || value === '') {
                continue;
            }

            if (name === 'class' || name === 'style') {
                setList(element, name, value);
            }
            else if (typeof value === 'function') {
                if (name[0] === 'o' && name[1] === 'n') {
                    runtime(element, name as `on${string}`, value as Function);
                }
                else {
                    reactive(element, name, value);
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

export { interpolate, setList, setProperty, setProperties };
