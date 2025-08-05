import { effect } from '@esportsplus/reactivity';
import { isArray, isFunction, isObject, isString } from '@esportsplus/utilities';
import { onCleanup } from './slot';
import { Attributes, Element } from './types';
import { className, raf, removeAttribute, setAttribute } from './utilities';
import event from './event';


let attributes: Record<string, unknown> = {},
    delimiters: Record<string, string> = {
        class: ' ',
        style: ';'
    },
    key = Symbol();


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

function set(element: Element, value: unknown, name: string, wait = false) {
    if (isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            set(element, value[i], name, wait);
        }
    }
    else if (isFunction(value)) {
        if (name.startsWith('on')) {
            event(element, name as `on${string}`, value);
        }
        else {
            let id = ('e' + store(element)[key]++);

            onCleanup(
                element,
                effect(() => {
                    let v = (value as Function)(element);

                    if (isArray(v)) {
                        let last = v.length - 1;

                        for (let i = 0, n = v.length; i < n; i++) {
                            update(element, id, name, v[i], wait || i !== last);
                        }
                    }
                    else {
                        update(element, id, name, v, wait);
                    }
                })
            );

            wait = false;
        }
    }
    else {
        update(element, null, name, value, wait);
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
            if (value && isString(value)) {
                data[cache] += (data[cache] ? delimiter : '') + value;
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
    else if (isString(id)) {
        if (data[name] === value) {
            return;
        }

        data[name] = value as string;
    }

    if (wait) {
        if (id === null) {
            attributes[name] = value;
        }
    }
    else {
        raf.add(() => {
            attribute(element, name, value);
        });
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
            set(element, attributes[name], name, true);
        }
    }
    else if (isArray(attributes)) {
        for (let i = 0, n = attributes.length; i < n; i++) {
            let attrs = attributes[i];

            for (let name in attrs) {
                set(element, attrs[name], name, true);
            }
        }
    }
};


export default { apply, spread };
export { apply, spread }