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

    if (!value || typeof value !== 'string') {
        return;
    }

    let delimiter = delimiters[name],
        store = (ctx ??= context(element)).store ??= {},
        v = store[name];

    if (v === undefined) {
        v = store[name] = (element.getAttribute(name) || '').trim();
    }

    if (id === null) {
        v = store[name] += (v ? delimiter : '') + value;
    }
    else {
        let current = delimiter + value,
            previous = store[id] as string | undefined;

        if (previous === undefined) {
            v = store[name] += current;
        }
        else if (previous !== current) {
            v = store[name] = (store[name] as string).replace(previous, current);
        }

        store[id] = current;
    }

    schedule(ctx, element, name, state, v);
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

    schedule(ctx, element, name, state, value);
}

function schedule(ctx: Context | null, element: Element, name: string, state: State, value: unknown) {
    if (state === STATE_HYDRATING) {
        apply(element, name, value);
        return;
    }

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


const set = (element: Element, name: string, value: unknown, state: State = STATE_HYDRATING) => {
    let fn = name === 'class' || name === 'style' ? list : property,
        type = typeof value;

    if (type === 'function') {
        if (name.startsWith('on')) {
            event(element, name as `on${string}`, value as Function);
            return;
        }

        let ctx = context(element);

        ctx.effect ??= 0;

        let id = (ctx.effect as number)++;

        effect(() => {
            let v = (value as Function)(element);

            if (v == null || typeof v !== 'object') {
                fn(ctx, element, id, name, v, state);
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
        fn(null, element, null, name, state, value);
        return;
    }

    if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            let v = value[i];

            if (v == null || v === false || v === '') {
                continue;
            }

            set(element, name, v, state);
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


export default { set, spread };
export { set, spread };