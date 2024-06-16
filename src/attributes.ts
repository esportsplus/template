import { effect, root } from '@esportsplus/reactivity';
import { ATTRIBUTES } from './constants';
import { Element, Properties } from './types';
import { className, isArray, raf, removeAttribute, setAttribute } from './utilities';
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

function store(element: Element) {
    return ( element[ATTRIBUTES] || (element[ATTRIBUTES] = { [ATTRIBUTES]: 0 }) ) as Properties & { [ATTRIBUTES]: number };
}

function update(element: Element, id: null | string, name: string, value: unknown, wait = false) {
    if (value === false || value == null) {
        value = '';
    }

    let cache = store(element);

    if (name in delimiters) {
        let delimiter = delimiters[name],
            dynamic = cache[name] as Properties | undefined;

        if (dynamic === undefined) {
            let value = (element.getAttribute(name) || '').trim();

            cache[name] = dynamic = {};
            cache[name + '.static'] = value.endsWith(delimiter) ? value.slice(0, -1) : value;
        }

        if (id === null) {
            if (typeof value === 'string' && value) {
                cache[name + '.static'] += (cache[name + '.static'] ? delimiter : '') + value;
            }
        }
        else {
            let hot: Properties = {};

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

            let cold = cache[id] as Properties | undefined;

            if (cold !== undefined) {
                for (let key in cold) {
                    if (key in hot) {
                        continue;
                    }

                    delete dynamic[key];
                }
            }

            cache[id] = hot;
        }

        value = cache[name + '.static'];

        for (let key in dynamic) {
            value += (value ? delimiter : '') + key;
        }
    }
    else if (typeof id === 'string') {
        if (cache[name] === value) {
            return;
        }

        cache[name] = value as string;
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
    },
    spread: (element: Element, properties: Properties) => {
        let data = store(element);

        for (let name in properties) {
            let value = properties[name];

            if (typeof value === 'function') {
                if (name.startsWith('on')) {
                    event(element, name, value);
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