import { effect, root } from '@esportsplus/reactivity';
import { ATTRIBUTES } from './constants';
import { Attributes, Element } from './types';
import { className, isArray, isObject, raf, removeAttribute, setAttribute } from './utilities';
import event from './event';


let attributes: Record<string, unknown> = {},
    delimiters: Record<string, string> = {
        class: ' ',
        style: ';'
    };


function attribute(element: Element, name: string, value: unknown) {
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

function reactive(element: Element, id: string, name: string, value: unknown, wait = false) {
    if (typeof value === 'function') {
        effect(() => {
            let v = (value as Function)(element);

            if (typeof v === 'function') {
                root(() => {
                    reactive(element, id, name, v(element), wait);
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

function set(element: Element, value: unknown, name: string) {
    if (typeof value === 'function') {
        if (name.startsWith('on')) {
            event(element, name, value);
        }
        else {
            reactive(element, ('e' + store(element)[ATTRIBUTES]++), name, value, true);
        }
    }
    else {
        update(element, null, name, value, true);
    }
}

function store(element: Element) {
    return ( element[ATTRIBUTES] || (element[ATTRIBUTES] = { [ATTRIBUTES]: 0 }) ) as Attributes & { [ATTRIBUTES]: number };
}

function update(element: Element, id: null | string, name: string, value: unknown, wait = false) {
    if (value === false || value == null) {
        value = '';
    }

    let data = store(element);

    if (name in delimiters) {
        let cache = name + '.static',
            delimiter = delimiters[name],
            dynamic = data[name] as Attributes | undefined;

        if (dynamic === undefined) {
            let value = (element.getAttribute(name) || '').trim();

            data[cache] = value.endsWith(delimiter) ? value.slice(0, -1) : value;
            data[name] = dynamic = {};
        }

        if (id === null) {
            if (typeof value === 'string' && value) {
                data[cache] += (data[cache] ? delimiter : '') + value;
            }
        }
        else {
            let hot: Attributes = {};

            if (typeof value === 'string') {
                let key: string,
                    keys = value.split(delimiter);

                for (let i = 0, n = keys.length; i < n; i ++) {
                    key = keys[i].trim();

                    if (key === '') {
                        continue;
                    }

                    dynamic[key] = null;
                    hot[key] = null;
                }
            }

            let cold = data[id] as Attributes | undefined;

            if (cold !== undefined) {
                for (let key in cold) {
                    if (key in hot) {
                        continue;
                    }

                    delete dynamic[key];
                }
            }

            data[id] = hot;
        }

        value = data[cache];

        for (let key in dynamic) {
            value += (value ? delimiter : '') + key;
        }
    }
    else if (typeof id === 'string') {
        if (data[name] === value) {
            return;
        }

        data[name] = value as string;
    }

    if (wait) {
        attributes[name] = value;
    }
    else {
        attribute(element, name, value);
    }
}


export default {
    apply: (element: Element) => {
        for (let key in attributes) {
            attribute(element, key, attributes[key]);
        }

        attributes = {};
    },
    set: (element: Element, value: unknown, name: string) => {
        if (isArray(value)) {
            for (let i = 0, n = value.length; i < n; i++) {
                set(element, value[i], name);
            }
        }
        else if (isObject(value) && name === 'style') {
            for (let key in value) {
                set(element, `${key}: ${value[key]};`, name);
            }
        }
        else {
            set(element, value, name);
        }
    },
    spread: function (element: Element, attributes: Attributes) {
        if (isArray(attributes)) {
            for (let i = 0, n = attributes.length; i < n; i++) {
                this.spread(element, attributes[i]);
            }

            return;
        }

        for (let name in attributes) {
            let value = attributes[name];

            if (isArray(value)) {
                for (let i = 0, n = value.length; i < n; i++) {
                    set(element, value[i], name);
                }
            }
            else if (isObject(value) && name === 'style') {
                for (let key in value) {
                    set(element, `${key}: ${value[key]};`, name);
                }
            }
            else {
                set(element, value, name);
            }
        }
    }
};