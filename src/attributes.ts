import { effect } from '@esportsplus/reactivity';
import { isArray, isObject } from '@esportsplus/utilities';
import { ATTRIBUTE_DELIMITERS, STATE_HYDRATING, STATE_NONE, STATE_WAITING, STORE } from './constants';
import { Attributes, Element } from './types';
import { raf } from './utilities';
import { runtime } from './event';
import q from '@esportsplus/queue';


type Context = {
    effect?: 0,
    element: Element;
    store?: Record<string, unknown>;
    updates?: Record<PropertyKey, unknown>;
    updating?: boolean;
} & Record<PropertyKey, unknown>;

type State = typeof STATE_HYDRATING | typeof STATE_NONE | typeof STATE_WAITING;


let queue = q<Context>(64),
    scheduled = false;


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
        dynamic = store[name] as Set<string>;

    // Runtime fallback
    if (!dynamic) {
        store[name + '.static'] = (element.getAttribute(name) || '').trim();
        store[name] = dynamic = new Set();
    }

    if (id === null) {
        if (value && typeof value === 'string') {
            changed = true;
            store[name + '.static'] += (store[name + '.static'] ? delimiter : '') + value;
        }
    }
    else if (store[id + '.raw'] !== value) {
        let hot: Record<PropertyKey, true> = {};

        if (value && typeof value === 'string') {
            let part: string | undefined,
                parts = (value as string).split(delimiter);

            while (part = parts.pop()) {
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

        let cold = store[id] as Record<PropertyKey, true>;

        if (cold !== undefined) {
            for (let part in cold) {
                if (hot[part] === true) {
                    continue;
                }

                changed = true;
                dynamic.delete(part);
            }
        }

        store[id + '.raw'] = value;
        store[id] = hot;
    }

    if (!changed) {
        return;
    }

    value = store[name + '.static'];

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

function reactive(element: Element, name: string, state: State, value: unknown) {
    let ctx = context(element),
        fn = (name === 'class' || name === 'style') ? list : property;

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


const setList = (element: Element, name: 'class' | 'style', value: unknown, attributes: Record<string, string> = {}) => {
    let ctx = context(element),
        store = ctx.store ??= {};

    store[name] ??= new Set<string>();
    store[name + '.static'] ??= '';
    store[name + '.static'] += `${attributes[name] && store[name + '.static'] ? ATTRIBUTE_DELIMITERS[name] : ''}${attributes[name]}`;

    if (typeof value === 'function') {
        reactive(element, name, STATE_HYDRATING, value);
    }
    else if (typeof value !== 'object') {
        list(ctx, element, null, name, STATE_HYDRATING, value);
    }
    else if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            let v = value[i];

            if (v == null || v === false || v === '') {
                continue;
            }

            list(ctx, element, null, name, STATE_HYDRATING, v);
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
    properties: Attributes | Attributes[] | false | null | undefined,
    attributes: Record<string, string> = {}
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
                setList(element, name, value, attributes);
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
            setProperties(element, properties[i], attributes);
        }
    }
};


export { setList, setProperty, setProperties };