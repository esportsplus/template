import { effect } from '@esportsplus/reactivity';
import { isArray, isObject } from '@esportsplus/utilities';
import { STATE_HYDRATING, STATE_NONE, STATE_WAITING } from './constants';
import { Attributes, Element } from './types';
import { className, removeAttribute, setAttribute } from './utilities/element';
import { raf } from './utilities/queue';
import q from '@esportsplus/queue';
import event from './event';


const STORE = Symbol();


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


function apply(element: Element, name: string, value: unknown) {
    if (value == null || value === false || value === '') {
        removeAttribute.call(element, name);
    }
    else if (name === 'class') {
        className.call(element, value as string);
    }
    else if (name === 'style' || name.startsWith('data-') || 'ownerSVGElement' in element) {
        setAttribute.call(element, name, value as string);
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

    let base = name + '.static',
        delimiter = delimiters[name],
        store = (ctx ??= context(element)).store ??= {},
        dynamic = store[name] as Set<string> | undefined,
        type = typeof value;

    if (dynamic === undefined) {
        let value = (element.getAttribute(name) || '').trim();

        store[base] = value;
        store[name] = dynamic = new Set();
    }

    if (id === null) {
        if (value && type === 'string') {
            store[base] += (store[base] ? delimiter : '') + value;
        }
    }
    else {
        let hot: Attributes = {};

        if (value && type === 'string') {
            let part: string,
                parts = (value as string).split(delimiter);

            for (let i = 0, n = parts.length; i < n; i++) {
                part = parts[i].trim();

                if (part === '') {
                    continue;
                }

                dynamic.add(part);
                hot[part] = null;
            }
        }

        let cold = store[id] as Attributes | undefined;

        if (cold !== undefined) {
            for (let part in cold) {
                if (part in hot) {
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
    raf.add(task);
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
        raf.add(task);
    }
    else {
        scheduled = false;
    }
}


const set = (element: Element, name: string, value: unknown) => {
    let fn = name === 'class' || name === 'style' ? list : property,
        state: State = STATE_HYDRATING,
        type = typeof value;

    if (type === 'function') {
        if (name.startsWith('on')) {
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

    if (type !== 'object') {
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
        let names = Object.keys(value),
            name;

        while (name = names.pop()) {
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


export default { set, spread };
export { set, spread };