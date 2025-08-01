import { computed, dispose, root } from '@esportsplus/reactivity';
import { oncleanup } from './slot';
import { Attributes, Element } from './types';
import { className, isArray, isObject, raf, removeAttribute, setAttribute } from './utilities';
import event from './event';


let attributes: Record<string, unknown> = {},
    delimiters: Record<string, string> = {
        class: ' ',
        style: ';'
    },
    key = Symbol();


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
        let instance = computed(() => {
                let v = (value as Function)(element);

                if (typeof v === 'function') {
                    root(() => {
                        reactive(element, id, name, v(element), wait);
                    });
                }
                else if (isArray(v) || isObject(v)) {
                    spread(element, v as Attributes | Attributes[]);
                }
                else {
                    raf.add(() => {
                        update(element, id, name, v, wait);
                    });
                }
            });

        oncleanup(element, () => dispose(instance));

        wait = false;
    }
    else {
        update(element, id, name, value, wait);
    }
}

function set(element: Element, value: unknown, name: string) {
    if (name === 'style' && isObject(value)) {
        for (let key in value) {
            set(element, value[key], name);
        }
    }
    else if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            set(element, value[i], name);
        }
    }
    else if (typeof value === 'function') {
        if (name.startsWith('on')) {
            event(element, name as `on${string}`, value);
        }
        else {
            reactive(element, ('e' + store(element)[key]++), name, value, true);
        }
    }
    else {
        update(element, null, name, value, true);
    }
}

function store(element: Element) {
    return (
        element[key] || (element[key] = { [key]: 0 })
    ) as Attributes & { [key]: number };
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
            if (value && typeof value === 'string') {
                data[cache] += (data[cache] ? delimiter : '') + value;
            }
        }
        else {
            let hot: Attributes = {};

            if (typeof value === 'string') {
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

            let cold = data[id] as Attributes | undefined;

            if (cold !== undefined) {
                for (let part in cold) {
                    if (part in hot) {
                        continue;
                    }

                    delete dynamic[part];
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


const apply = (element: Element) => {
    for (let key in attributes) {
        attribute(element, key, attributes[key]);
    }

    attributes = {};
};

const spread = function (element: Element, attributes: Attributes | Attributes[]) {
    if (isObject(attributes)) {
        for (let name in attributes) {
            set(element, attributes[name], name);
        }
    }
    else if (isArray(attributes)) {
        for (let i = 0, n = attributes.length; i < n; i++) {
            let attrs = attributes[i];

            if (!isObject(attrs)) {
                throw new Error('@esportsplus/template: attributes must be of type `Attributes` or `Attributes[]`; Received ' + JSON.stringify(attributes));
            }

            for (let name in attrs) {
                set(element, attrs[name], name);
            }
        }
    }
    else {
        throw new Error('@esportsplus/template: attributes must be of type `Attributes` or `Attributes[]`; Received ' + JSON.stringify(attributes));
    }
};


export default { apply, spread };
export { apply, spread }