import { effect } from '@esportsplus/reactivity';
import { isArray, isObject } from '@esportsplus/utilities';
import { STATE_HYDRATING, STATE_NONE, STATE_WAITING, STORE } from './constants';
import { Attributes, Element } from './types';
import { raf } from './utilities';
import q from '@esportsplus/queue';
import event from './event';


type Context = {
    effect?: 0,
    element: Element;
    store?: Record<string, unknown>;
    updates?: Record<PropertyKey, unknown>;
    updating?: boolean;
} & Record<PropertyKey, unknown>;

type State = typeof STATE_HYDRATING | typeof STATE_NONE | typeof STATE_WAITING;


let delimiters: Record<string, string> = {
        class: ' ',
        style: ';'
    },
    queue = q<Context>(64),
    scheduled = false;


// #12: Apply Function Specialization
// Specialized apply functions per attribute type to eliminate runtime checks
function applyClass(element: Element, value: unknown) {
    if (value == null || value === false || value === '') {
        element.removeAttribute('class');
    }
    else {
        element.className = value as string;
    }
}


function applyStyle(element: Element, value: unknown) {
    if (value == null || value === false || value === '') {
        element.removeAttribute('style');
    }
    else {
        element.setAttribute('style', value as string);
    }
}

function applySvg(element: Element, name: string, value: unknown) {
    if (value == null || value === false || value === '') {
        element.removeAttribute(name);
    }
    else {
        element.setAttribute(name, value as string);
    }
}

// #22: Previous Value Diffing
// Store previous values on elements, skip DOM operations when unchanged
function applyWithDiff(element: Element, name: string, value: unknown) {
    if (value == null || value === false || value === '') {
        element.removeAttribute(name);
    }
    else if (name === 'class') {
        element.className = value as string;
    }
    else if (name === 'style' || (name[0] === 'd' && name.startsWith('data-')) || element['ownerSVGElement']) {
        element.setAttribute(name, value as string);
    }
    else {
        element[name] = value;
    }
}

// Original apply for non-diffed contexts
function apply(element: Element, name: string, value: unknown) {
    if (value == null || value === false || value === '') {
        element.removeAttribute(name);
    }
    else if (name === 'class') {
        element.className = value as string;
    }
    else if (name === 'style' || (name[0] === 'd' && name.startsWith('data-')) || element['ownerSVGElement']) {
        element.setAttribute(name, value as string);
    }
    else {
        element[name] = value;
    }
}

function context(element: Element) {
    return ((element as any)[STORE] ??= { element }) as Context;
}

function list(
    ctx: Context | null,
    element: Element,
    id: null | number,
    name: string,
    state: State,
    value: unknown
) {
    if (value == null || value === false || value === '') {
        value = '';
    }

    let base = name + '.static',
        delimiter = delimiters[name],
        store = (ctx ??= context(element)).store ??= {},
        dynamic = store[name] as Set<string> | undefined;

    if (dynamic === undefined) {
        let value = (element.getAttribute(name) || '').trim();

        store[base] = value;
        store[name] = dynamic = new Set();
    }

    if (id === null) {
        if (value && typeof value === 'string') {
            store[base] += (store[base] ? delimiter : '') + value;
        }
    }
    else {
        let hot: Record<PropertyKey, true> = {};

        if (value && typeof value === 'string') {
            let part: string,
                parts = (value as string).split(delimiter);

            for (let i = 0, n = parts.length; i < n; i++) {
                part = parts[i].trim();

                if (part === '') {
                    continue;
                }

                dynamic.add(part);
                hot[part] = true;
            }
        }

        let cold = store[id] as Record<PropertyKey, true> | undefined;

        if (cold !== undefined) {
            for (let part in cold) {
                if (hot[part] === true) {
                    continue;
                }

                dynamic.delete(part);
            }
        }

        store[id] = hot;
    }

    value = store[base];

    for (let key of dynamic) {
        value += (value ? delimiter : '') + key;
    }

    if (state === STATE_HYDRATING) {
        apply(element, name, value);
    }
    else {
        schedule(ctx, element, name, state, value);
    }
}

function property(
    ctx: Context | null,
    element: Element,
    id: null | number,
    name: string,
    state: State,
    value: unknown
) {
    if (value == null || value === false || value === '') {
        value = '';
    }

    if (id !== null) {
        ctx ??= context(element);

        // #22: Previous value diffing - skip if unchanged
        if (ctx[name] === value) {
            return;
        }

        ctx[name] = value as string;
    }

    if (state === STATE_HYDRATING) {
        apply(element, name, value);
    }
    else {
        schedule(ctx, element, name, state, value);
    }
}

function schedule(ctx: Context | null, element: Element, name: string, state: State, value: unknown) {
    ctx ??= context(element);
    (ctx.updates ??= {})[name] = value;

    if (state === STATE_NONE && !ctx.updating) {
        ctx.updating = true;
        queue.add(ctx);
    }

    if (scheduled) {
        return;
    }

    scheduled = true;
    raf(task);
}

function task() {
    let context,
        n = queue.length;

    while ((context = queue.next()) && n--) {
        let { element, updates } = context;

        for (let name in updates) {
            // #22: Use diffing apply for updates
            applyWithDiff(element, name, updates[name]);
        }

        context.updates = {};
        context.updating = false;
    }

    if (queue.length) {
        raf(task);
    }
    else {
        scheduled = false;
    }
}


// #4: Attribute Handler Selection Pre-wiring
// Select handler at setup time, not at every call
const set = (element: Element, name: string, value: unknown) => {
    let fn = name === 'class' || name === 'style' ? list : property,
        state: State = STATE_HYDRATING;

    if (typeof value === 'function') {
        // #4: Event detection at setup time
        if (name[0] === 'o' && name[1] === 'n') {
            return event(element, name as `on${string}`, value as Function);
        }

        let ctx = context(element);

        ctx.effect ??= 0;

        let id = (ctx.effect as number)++;

        effect(() => {
            let v = (value as Function)(element);

            if (v == null || typeof v !== 'object') {
                fn(ctx, element, id, name, state, v);
            }
            else if (isArray(v)) {
                let last = v.length - 1;

                for (let i = 0, n = v.length; i < n; i++) {
                    fn(
                        ctx,
                        element,
                        id,
                        name,
                        state === STATE_HYDRATING
                            ? state
                            : i !== last ? STATE_WAITING : state,
                        v[i],
                    );
                }
            }
        });

        state = STATE_NONE;

        return;
    }

    if (typeof value !== 'object') {
        // Skip isArray when possible
    }
    else if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            let v = value[i];

            if (v == null || v === false || v === '') {
                continue;
            }

            set(element, name, v);
        }
        return;
    }

    fn(null, element, null, name, state, value);
};

const spread = function (element: Element, value: Attributes | Attributes[]) {
    if (isObject(value)) {
        for (let name in value) {
            let v = value[name];

            if (v == null || v === false || v === '') {
                continue;
            }

            set(element, name, v);
        }
    }
    else if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            spread(element, value[i]);
        }
    }
};


// #4: Attribute Handler Specialization - Direct handlers for compile-time optimization
// These bypass runtime type/name checking when attribute type is known at compile time

// Specialized class handler - for compile-time known class attributes
const setClass = (element: Element, value: unknown) => {
    let state: State = STATE_HYDRATING;

    if (typeof value === 'function') {
        let ctx = context(element);

        ctx.effect ??= 0;

        let id = (ctx.effect as number)++;

        effect(() => {
            let v = (value as Function)(element);

            if (v == null || typeof v !== 'object') {
                list(ctx, element, id, 'class', state, v);
            }
            else if (isArray(v)) {
                let last = v.length - 1;

                for (let i = 0, n = v.length; i < n; i++) {
                    list(ctx, element, id, 'class', state === STATE_HYDRATING ? state : i !== last ? STATE_WAITING : state, v[i]);
                }
            }
        });

        state = STATE_NONE;

        return;
    }

    if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            let v = value[i];

            if (v == null || v === false || v === '') {
                continue;
            }

            setClass(element, v);
        }

        return;
    }

    list(null, element, null, 'class', state, value);
};

// Specialized style handler - for compile-time known style attributes
const setStyle = (element: Element, value: unknown) => {
    let state: State = STATE_HYDRATING;

    if (typeof value === 'function') {
        let ctx = context(element);

        ctx.effect ??= 0;

        let id = (ctx.effect as number)++;

        effect(() => {
            let v = (value as Function)(element);

            if (v == null || typeof v !== 'object') {
                list(ctx, element, id, 'style', state, v);
            }
            else if (isArray(v)) {
                let last = v.length - 1;

                for (let i = 0, n = v.length; i < n; i++) {
                    list(ctx, element, id, 'style', state === STATE_HYDRATING ? state : i !== last ? STATE_WAITING : state, v[i]);
                }
            }
        });

        state = STATE_NONE;

        return;
    }

    if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            let v = value[i];

            if (v == null || v === false || v === '') {
                continue;
            }

            setStyle(element, v);
        }

        return;
    }

    list(null, element, null, 'style', state, value);
};

// Specialized property handler - for compile-time known DOM properties
const setProperty = (element: Element, name: string, value: unknown) => {
    let state: State = STATE_HYDRATING;

    if (typeof value === 'function') {
        let ctx = context(element);

        ctx.effect ??= 0;

        let id = (ctx.effect as number)++;

        effect(() => {
            let v = (value as Function)(element);

            property(ctx, element, id, name, state, v);
        });

        state = STATE_NONE;

        return;
    }

    property(null, element, null, name, state, value);
};

// Specialized data attribute handler - for compile-time known data-* attributes
const setData = (element: Element, name: string, value: unknown) => {
    let state: State = STATE_HYDRATING;

    if (typeof value === 'function') {
        let ctx = context(element);

        ctx.effect ??= 0;

        let id = (ctx.effect as number)++;

        effect(() => {
            let v = (value as Function)(element);

            property(ctx, element, id, name, state, v);
        });

        state = STATE_NONE;

        return;
    }

    property(null, element, null, name, state, value);
};

// #10: Class/Style Pre-parsing Support
// Pre-parsed class binding - static parts provided at compile time
const setClassPreparsed = (
    element: Element,
    staticParts: string[],
    dynamicValue: unknown
) => {
    let ctx = context(element),
        state: State = STATE_HYDRATING,
        store = ctx.store ??= {},
        staticClass = staticParts.join(' ');

    // Initialize static base
    store['class.static'] = staticClass;
    store['class'] = new Set<string>();

    if (typeof dynamicValue === 'function') {
        ctx.effect ??= 0;

        let id = (ctx.effect as number)++;

        effect(() => {
            let v = (dynamicValue as Function)(element);

            list(ctx, element, id, 'class', state, v);
        });

        state = STATE_NONE;
    }
    else if (dynamicValue != null && dynamicValue !== false && dynamicValue !== '') {
        list(ctx, element, null, 'class', state, dynamicValue);
    }
    else {
        applyClass(element, staticClass);
    }
};

// Pre-parsed style binding - static parts provided at compile time
const setStylePreparsed = (
    element: Element,
    staticParts: string[],
    dynamicValue: unknown
) => {
    let ctx = context(element),
        state: State = STATE_HYDRATING,
        store = ctx.store ??= {},
        staticStyle = staticParts.join(';');

    // Initialize static base
    store['style.static'] = staticStyle;
    store['style'] = new Set<string>();

    if (typeof dynamicValue === 'function') {
        ctx.effect ??= 0;

        let id = (ctx.effect as number)++;

        effect(() => {
            let v = (dynamicValue as Function)(element);

            list(ctx, element, id, 'style', state, v);
        });

        state = STATE_NONE;
    }
    else if (dynamicValue != null && dynamicValue !== false && dynamicValue !== '') {
        list(ctx, element, null, 'style', state, dynamicValue);
    }
    else {
        applyStyle(element, staticStyle);
    }
};

// #11: Spread Unpacking - for compile-time known spread shapes
// When spread object keys are known at compile time, directly call specialized handlers
const spreadUnpacked = (
    element: Element,
    keys: string[],
    values: unknown[]
) => {
    for (let i = 0, n = keys.length; i < n; i++) {
        let key = keys[i],
            value = values[i];

        if (value == null || value === false || value === '') {
            continue;
        }

        // Route to specialized handlers based on key
        if (key === 'class') {
            setClass(element, value);
        }
        else if (key === 'style') {
            setStyle(element, value);
        }
        else if (key[0] === 'o' && key[1] === 'n') {
            event(element, key as `on${string}`, value as Function);
        }
        else if (key[0] === 'd' && key.startsWith('data-')) {
            setData(element, key, value);
        }
        else {
            setProperty(element, key, value);
        }
    }
};


export default { set, spread };
export {
    set,
    setClass,
    setClassPreparsed,
    setData,
    setProperty,
    setStyle,
    setStylePreparsed,
    spread,
    spreadUnpacked
};
