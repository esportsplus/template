import { effect, root } from '@esportsplus/reactivity';
import { ATTRIBUTES } from './constants';
import { Element, Properties } from './types';
import { className, isArray, raf, removeAttribute, setAttribute } from './utilities';
import event from './event';


let delimiters: Record<string, string> = {
        class: ' ',
        style: ';'
    },
    updates: Record<string, Function> | null = null;


function normalize(name: keyof typeof delimiters, value: unknown, properties: Properties = {}) {
    if (typeof value === 'string') {
        let key,
            keys = value.split(delimiters[name]);

        for (let i = 0, n = keys.length; i < n; i ++) {
            key = keys[i];

            if (key) {
                properties[key] = null;
            }
        }
    }

    return properties;
}

function reactive(element: Element, id: string, name: string, value: unknown, wait = false) {
    if (typeof value === 'function') {
        effect(() => {
            let v = (value as Function)();

            if (typeof v === 'function') {
                root(() => {
                    reactive(element, id, name, v(), wait);
                });
            }
            else {
                raf.add(() => {
                    update(element, id, name, v, wait);
                });
            }
        });
        wait = false;
    }
    else {
        update(element, id, name, value, wait);
    }
}

function set(element: Element, name: string, value: unknown) {
    if (value === false || value == null) {
        value = '';
    }

    if (value === '') {
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

function store(element: Element, name?: string) {
    let data = (
            element[ATTRIBUTES] || (element[ATTRIBUTES] = { [ATTRIBUTES]: 0 })
        ) as Properties & { [ATTRIBUTES]: number };

    if (name !== undefined && name in data === false) {
        data[name] = normalize(name, element.getAttribute(name));
    }

    return data;
}

function update(element: Element, id: null | string, name: string, value: unknown, wait = false) {
    if (value === false || value == null) {
        value = '';
    }

    if (name in delimiters) {
        let data = store(element, name),
            delimiter = delimiters[name] || '',
            fresh = normalize(name, value),
            values = data[name] as Properties;

        for (let key in fresh) {
            values[key] = null;
        }

        if (typeof id === 'string') {
            let stale = data[id] as Properties | undefined;

            if (stale !== undefined) {
                for (let key in stale) {
                    if (key in fresh) {
                        continue;
                    }

                    delete values[key];
                }
            }

            data[id] = fresh;
        }

        value = '';

        for (let key in values) {
            value += (value ? delimiter : '') + key;
        }
    }
    else if (id !== null) {
        let data = store(element);

        if (data[name] === value) {
            return;
        }

        data[name] = value as string;
    }

    if (wait) {
        if (updates === null) {
            updates = {
                [name]: () => set(element, name, value)
            };
        }
        else {
            updates[name] = () => set(element, name, value);
        }
    }
    else {
        set(element, name, value);
    }
}


export default {
    apply: () => {
        if (updates === null) {
            return;
        }

        for (let key in updates) {
            updates[key]();
        }

        updates = null;
    },
    set: (element: Element, value: unknown, name: string) => {
        if (typeof value === 'function') {
            reactive(element, ('e' + store(element)[ATTRIBUTES]++), name, value, true);
        }
        else {
            update(element, null, name, value, true);
        }
    },
    spread: (element: Element, properties: Properties) => {
        let data = store(element);

        for (let name in properties) {
            let value = properties[name];

            if (typeof value === 'function') {
                if (name.startsWith('on')) {
                    event(element, value as Function, name);
                }
                else {
                    reactive(element, ('e' + data[ATTRIBUTES]++), name, value, true);
                }
            }
            else if (isArray(value)) {
                for (let i = 0, n = value.length; i < n; i++) {
                    let v = value[i];

                    if (typeof v === 'function') {
                        reactive(element, ('e' + data[ATTRIBUTES]++), name, v, true);
                    }
                    else {
                        update(element, null, name, v, true);
                    }
                }
            }
            else {
                update(element, null, name, value, true);
            }
        }
    }
};