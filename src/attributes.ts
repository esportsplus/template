import { effect } from '@esportsplus/reactivity';
import { isArray, isObject, isString } from '@esportsplus/utilities';
import { ondisconnect } from './slot/cleanup';
import { STATE_HYDRATING, STATE_NONE, STATE_WAITING } from './constants';
import { Attributes, Element } from './types';
import { className, raf, removeAttribute, setAttribute } from './utilities';
import q from '@esportsplus/queue';
import event from './event';


const EFFECT = Symbol();

const STORE = Symbol();

const UPDATES = Symbol();


type Context = {
    element: Element;
    store: Record<PropertyKey, unknown>
    updates: Record<PropertyKey, unknown>;
    updating: boolean;
};

type State = typeof STATE_HYDRATING | typeof STATE_NONE | typeof STATE_WAITING;


let delimiters: Record<string, string> = {
        class: ' ',
        style: ';'
    },
    queue = q<Context>(64),
    scheduled = false;


function attribute(element: Element, name: string, value: unknown) {
    if (value === '' || value === false || value == null) {
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

function schedule() {
    if (scheduled) {
        return;
    }

    scheduled = true;
    raf.add(task);
}

function set(context: Context, name: string, value: unknown, state: State) {
    if (value === false || value == null) {
        value = '';
    }

    let type = typeof value;

    if (type === 'function') {
        if (name.startsWith('on')) {
            event(context.element, name as `on${string}`, value as Function);
        }
        else {
            context.store[EFFECT] ??= 0;

            let id = (context.store[EFFECT] as number)++;

            ondisconnect(
                context.element,
                effect(() => {
                    let v = (value as Function)(context.element);

                    if (isArray(v)) {
                        let last = v.length - 1;

                        for (let i = 0, n = v.length; i < n; i++) {
                            update(
                                context,
                                id,
                                name,
                                v[i],
                                state === STATE_HYDRATING
                                    ? state
                                    : i !== last ? STATE_WAITING : state
                            );
                        }
                    }
                    else {
                        update(context, id, name, v, state);
                    }
                })
            );

            state = STATE_NONE;
        }
    }
    else if (type === 'object') {
        if (isArray(value)) {
            for (let i = 0, n = value.length; i < n; i++) {
                set(context, name, value[i], state);
            }
        }
    }
    else {
        update(context, null, name, value, state);
    }
}

function task() {
    let context,
        n = queue.length;

    while ((context = queue.next()) && n--) {
        let { element, updates } = context;

        for (let name in updates) {
            attribute(element, name, updates[name]);
            delete updates[name];
        }

        context.updating = false;
    }

    if (queue.length) {
        raf.add(task);
    }
    else {
        scheduled = false;
    }
}

function update(
    context: Context,
    id: null | number,
    name: string,
    value: unknown,
    state: State
) {
    if (value === false || value == null) {
        value = '';
    }

    let store = context.store;

    if (name in delimiters) {
        let cache = name + '.static',
            delimiter = delimiters[name],
            dynamic = store[name] as Attributes | undefined;

        if (dynamic === undefined) {
            let value = (context.element.getAttribute(name) || '').trim();

            store[cache] = value;
            store[name] = dynamic = {};
        }

        if (id === null) {
            if (value && isString(value)) {
                store[cache] += (store[cache] ? delimiter : '') + value;
            }
        }
        else {
            let hot: Attributes = {};

            if (isString(value)) {
                let part: string,
                    parts = value.split(delimiter);

                for (let i = 0, n = parts.length; i < n; i++) {
                    part = parts[i].trim();

                    if (part === '') {
                        continue;
                    }

                    dynamic[part] = null;
                    hot[part] = null;
                }
            }

            let cold = store[id] as Attributes | undefined;

            if (cold !== undefined) {
                for (let part in cold) {
                    if (part in hot) {
                        continue;
                    }

                    delete dynamic[part];
                }
            }

            store[id] = hot;
        }

        value = store[cache];

        for (let key in dynamic) {
            value += (value ? delimiter : '') + key;
        }
    }
    else if (id !== null) {
        if (store[name] === value) {
            return;
        }

        store[name] = value as string;
    }

    if (state === STATE_HYDRATING) {
        attribute(context.element, name, value);
    }
    else {
        context.updates[name] = value;

        if (state === STATE_NONE && !context.updating) {
            context.updating = true;
            queue.add(context);
        }

        if (!scheduled) {
            schedule();
        }
    }
}


const spread = function (element: Element, value: Attributes | Attributes[]) {
    let cache = (element[STORE] ??= { [UPDATES]: {} }) as Record<PropertyKey, unknown>,
        context = {
            element,
            store: cache,
            updates: cache[UPDATES] as Record<PropertyKey, unknown>,
            updating: false
        };

    if (isObject(value)) {
        for (let name in value) {
            set(context, name, value[name], STATE_HYDRATING);
        }
    }
    else if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            let v = value[i];

            for (let name in v) {
                set(context, name, v[name], STATE_HYDRATING);
            }
        }
    }
};


export default { spread };
export { spread };