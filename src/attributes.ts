import { effect } from '@esportsplus/reactivity';
import { isArray, isObject } from '@esportsplus/utilities';
import { ATTRIBUTE_DELIMITERS, STATE_HYDRATING, STATE_NONE, STATE_WAITING, STORE } from './constants';
import { Attributes, Element } from './types';
import { raf } from './utilities';
import { runtime } from './event';
import q from '@esportsplus/queue';


type Context = {
    cold?: Record<number, Record<PropertyKey, true>>;
    effect?: number,
    element: Element;
    raw?: unknown[];
    store?: Record<string, unknown>;
    updates?: Record<PropertyKey, unknown>;
    updating?: boolean;
    values?: Record<string, unknown>;
};

type State = typeof STATE_HYDRATING | typeof STATE_NONE | typeof STATE_WAITING;

type ListState = {
    dynamic: Set<string>;
    static: string;
};


let queue = q<Context>(64),
    scheduled = false;


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
        return;
    }

    value = listState.static;

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

        let values = ctx.values ??= {};

        if (values[name] === value) {
            return;
        }

        values[name] = value;
    }

    if (state === STATE_HYDRATING) {
        apply(element, name, value);
    }
    else {
        schedule(ctx, element, name, state, value);
    }
}

function reactive(element: Element, name: string, state: State, value: unknown) {
    let ctx = context(element),
        fn = (name === 'class' || name === 'style') ? list : property;

    ctx.effect ??= 0;

    let id = ctx.effect++;

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
            apply(element, name, updates[name]);
            delete updates[name];
        }

        context.updating = false;
    }

    if (queue.length) {
        raf(task);
    }
    else {
        scheduled = false;
    }
}


const setList = (element: Element, name: 'class' | 'style', value: unknown) => {
    if (typeof value === 'function') {
        reactive(element, name, STATE_HYDRATING, value);
    }
    else if (typeof value !== 'object') {
        list(null, element, null, name, STATE_HYDRATING, value);
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
        reactive(element, name, STATE_HYDRATING, value);
    }
    else {
        property(null, element, null, name, STATE_HYDRATING, value);
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
                    reactive(element, name, STATE_HYDRATING, value);
                }
            }
            else  {
                property(null, element, null, name, STATE_HYDRATING, value);
            }
        }
    }
    else if (isArray(properties)) {
        for (let i = 0, n = properties.length; i < n; i++) {
            setProperties(element, properties[i]);
        }
    }
};


export { setList, setProperty, setProperties };
