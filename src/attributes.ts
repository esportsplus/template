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

// What every writer of an element shares: its lists, and the last value of each plain attribute
type Context = {
    store?: Record<string, unknown>;
    values?: Record<string, unknown>;
};

type ListState = {
    dynamic: Set<string>;
    static: string;
};

// What one reactive list part alone reads: the value of its last run and the tokens it put in the list
type Part = {
    raw: unknown;
    tokens: string[] | null;
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

// Whether a part binds reactively: a function, or an array holding one
function bound(value: unknown): boolean {
    if (typeof value === 'function') {
        return true;
    }

    if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            if (bound(value[i])) {
                return true;
            }
        }
    }

    return false;
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
    return (element[STORE] ??= {}) as Context;
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

// Whether 'value' changes the element's list. A static value (no part) appends to the list's static part.
function list(ctx: Context, element: Element, part: Part | null, name: string, value: unknown) {
    if (empty(value)) {
        value = '';
    }

    let changed = false,
        delimiter = ATTRIBUTE_DELIMITERS[name],
        listState = state(ctx, element, name);

    if (part === null) {
        let tokens: string[] = [];

        collect(name, delimiter, value, tokens);

        for (let i = 0, n = tokens.length; i < n; i++) {
            changed = true;
            listState.static += (listState.static ? delimiter : '') + tokens[i];
        }
    }
    // An array or object is diffed whole each run: it may be the same instance with new contents
    else if (typeof value === 'object' || part.raw !== value) {
        let dynamic = listState.dynamic,
            previous = part.tokens,
            tokens: string[] = [];

        collect(name, delimiter, value, tokens);

        for (let i = 0, n = tokens.length; i < n; i++) {
            let token = tokens[i];

            if (!dynamic.has(token)) {
                changed = true;
                dynamic.add(token);
            }
        }

        if (previous !== null) {
            for (let i = 0, n = previous.length; i < n; i++) {
                let token = previous[i];

                if (tokens.indexOf(token) === -1) {
                    changed = true;
                    dynamic.delete(token);
                }
            }
        }

        part.raw = value;
        part.tokens = tokens;
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

// The value to write once 'value' changes the binding, undefined while it stays as it is. A static value
// (no context) always writes.
function property(ctx: Context | null, name: string, value: unknown) {
    if (empty(value)) {
        value = '';
    }

    if (ctx !== null) {
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
    let mounted = false,
        parent = current(),
        part: Part | null = name === 'class' || name === 'style' ? { raw: undefined, tokens: null } : null,
        slot: Slot | null = null,
        stop: VoidFunction;

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
        if (part !== null) {
            let previous = part.tokens;

            if (!list(ctx, element, part, name, v)) {
                return;
            }

            if (batch !== null && batch.open) {
                batch.changed = true;
            }
            else {
                rewrite(ctx, element, name, previous, part.tokens!);
            }

            return;
        }

        // A plain attribute has no object form
        if (v != null && typeof v === 'object') {
            return;
        }

        let next = property(ctx, name, v);

        if (next !== undefined) {
            apply(element, name, next);
        }
    });

    unowned(element, stop);
}

// Writes a list after one part's rerun changed it from 'previous' to 'tokens'. A style part whose change keeps every
// declaration's name, where no other writer declares those names, sets just the changed values: the store still
// records every writer's declarations, and the next whole write joins them all.
function rewrite(ctx: Context, element: Element, name: string, previous: string[] | null, tokens: string[]) {
    let listState = ctx.store![name] as ListState;

    if (name === 'style' && previous !== null && previous.length === tokens.length) {
        let declared = true,
            style = element.style;

        for (let i = 0, n = tokens.length; i < n && declared; i++) {
            let next = tokens[i];

            if (next === previous[i]) {
                continue;
            }

            let colon = next.indexOf(':'),
                property = colon > 0 ? next.slice(0, colon).trim() : '',
                was = previous[i].indexOf(':');

            declared = property !== '' &&
                was > 0 &&
                previous[i].slice(0, was).trim() === property &&
                sole(listState, property, next);
        }

        if (declared) {
            for (let i = 0, n = tokens.length; i < n; i++) {
                let next = tokens[i];

                if (next === previous[i]) {
                    continue;
                }

                let colon = next.indexOf(':'),
                    value = next.slice(colon + 1).trim(),
                    important = value.endsWith('!important');

                style.setProperty(
                    next.slice(0, colon).trim(),
                    important ? value.slice(0, -10).trimEnd() : value,
                    important ? 'important' : ''
                );
            }

            return;
        }
    }

    apply(element, name, join(listState, ATTRIBUTE_DELIMITERS[name]));
}

// The list the element's attribute holds, as a static list
function seed(element: Element, name: string) {
    let delimiter = ATTRIBUTE_DELIMITERS[name],
        value = (element.getAttribute(name) || '').trim();

    // A browser-serialised cssText ends in ';', which would join as ';;'
    if (value.endsWith(delimiter)) {
        value = value.slice(0, -1).trimEnd();
    }

    return value;
}

// A list nobody wrote (undefined) or only static writers wrote (null) lives in the attribute alone
function state(ctx: Context, element: Element, name: string) {
    let store = ctx.store ??= {},
        listState = store[name] as ListState | null | undefined;

    if (!listState) {
        listState = { dynamic: new Set(), static: seed(element, name) };
        store[name] = listState;
    }

    return listState;
}

// Whether 'token' is the only declaration of 'property' in the list, static part included
function sole(listState: ListState, property: string, token: string) {
    let declarations = listState.static;

    if (declarations.indexOf(property) !== -1) {
        let parts = declarations.split(';');

        for (let i = 0, n = parts.length; i < n; i++) {
            let colon = parts[i].indexOf(':');

            if (colon > 0 && parts[i].slice(0, colon).trim() === property) {
                return false;
            }
        }
    }

    for (let key of listState.dynamic) {
        if (key !== token && key.startsWith(property) && key.slice(0, key.indexOf(':')).trim() === property) {
            return false;
        }
    }

    return true;
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
        statics = parts[0] as string;

    if (statics === '') {
        let i = 1;

        while (i < n && empty(parts[i])) {
            i++;
        }

        if (i === n) {
            return;
        }
    }

    let existing = (element[STORE] as Context | undefined)?.store?.[name];

    // Nothing binds and nobody wrote the list: join it and write the attribute, with no list state
    if (existing === undefined) {
        let i = 1;

        while (i < n && !bound(parts[i])) {
            i++;
        }

        if (i === n) {
            let delimiter = ATTRIBUTE_DELIMITERS[name],
                joined = statics,
                tokens: string[] = [];

            for (let j = 1; j < n; j++) {
                collect(name, delimiter, parts[j], tokens);
            }

            for (let j = 0, m = tokens.length; j < m; j++) {
                joined += (joined ? delimiter : '') + tokens[j];
            }

            if (joined !== '') {
                apply(element, name, joined);
            }

            return;
        }
    }

    let batch: Batch = { changed: false, open: true },
        changed = false,
        ctx = context(element),
        store = ctx.store ??= {};

    if (existing === undefined) {
        store[name] = { dynamic: new Set(), static: statics } satisfies ListState;
        changed = statics !== '';
    }
    else {
        state(ctx, element, name);

        if (statics !== '') {
            changed = list(ctx, element, null, name, statics);
        }
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
        let ctx = context(element),
            store = ctx.store ??= {};

        if (store[name]) {
            if (list(ctx, element, null, name, value)) {
                apply(element, name, join(store[name] as ListState, ATTRIBUTE_DELIMITERS[name]));
            }

            return;
        }

        // Until a reactive writer needs the list state, a static value appends to the attribute itself
        let delimiter = ATTRIBUTE_DELIMITERS[name],
            tokens: string[] = [];

        collect(name, delimiter, value, tokens);

        if (tokens.length === 0) {
            return;
        }

        let joined = seed(element, name);

        for (let i = 0, n = tokens.length; i < n; i++) {
            joined += (joined ? delimiter : '') + tokens[i];
        }

        store[name] = null;
        apply(element, name, joined);
    }
};

const setProperty = (element: Element, name: string, value: unknown) => {
    if (typeof value === 'function') {
        reactive(context(element), element, name, value, null);
    }
    else {
        apply(element, name, property(null, name, value));
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
                apply(element, name, property(null, name, value));
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


export { setClass, setList, setProperty, setProperties, setStyle };
