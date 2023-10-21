import { effect, root, DIRTY } from '@esportsplus/reactivity';
import { ATTRIBUTES } from './constants';
import { Element } from './types';
import { className, isArray, removeAttribute, setAttribute } from './utilities';
import raf from './raf';


type Data = {
    bucket?: Record<PropertyKey, unknown>;
    id: number;
    name: string;
    value: string;
};


let delimiters: Record<string, string> = {
        class: ' ',
        style: ';'
    };


function normalize(name: keyof typeof delimiters, value: unknown) {
    let cache: Record<PropertyKey, null> = {};

    if (typeof value === 'string') {
        let values = value.split(delimiters[name]);

        for (let i = 0, n = values.length; i < n; i ++) {
            let value = values[i];

            if (value) {
                cache[value] = null;
            }
        }
    }

    return cache;
}

function reactive(data: Data, element: Element, id: string, input: unknown, wait = false) {
    if (typeof input === 'function') {
        effect((self) => {
            let v = (input as Function)();

            if (typeof v === 'function') {
                root(() => {
                    reactive(data, element, id, v(), wait);
                });
            }
            else if (self.state === DIRTY) {
                reactive(data, element, id, v, wait);
            }
            else {
                raf.add(() => {
                    reactive(data, element, id, v, wait);
                });
            }
        });
        wait = false;
        return;
    }

    let bucket = data.bucket!,
        name = data.name;

    if (name in delimiters) {
        let cache = (bucket[name] || (bucket[name] = {})) as Record<PropertyKey, null>,
            delimiter = delimiters[name] || '',
            fresh = normalize(name as keyof typeof delimiters, input),
            stale = bucket[id];

        bucket[id] = fresh;

        for (let key in fresh) {
            if (key in cache) {
                continue;
            }

            cache[key] = null;
        }

        if (stale) {
            for (let key in stale) {
                if (key in fresh) {
                    continue;
                }

                delete cache[key];
            }
        }

        input = '';

        for (let key in cache) {
            input += (input ? delimiter : '') + key;
        }
    }
    else {
        if (bucket[name] === input && wait === false) {
            return;
        }

        bucket[name] = input as string;
    }

    if (wait === false) {
        set(data, element, input);
    }
}

function set(data: Data, element: Element, input: unknown) {
    if (input === false || input == null) {
        return;
    }

    let name = data.name,
        value = data.value + (data.value && input ? (delimiters[name] || '') : '') + input;

    if (data.value === value) {
        return;
    }

    if (value === '') {
        removeAttribute.call(element, name);
    }
    else if (name === 'class') {
        className.call(element, value);
    }
    else if ((name[0] === 'data' && name.slice(0, 5) === 'data-') || name === 'style') {
        setAttribute.call(element, name, value);
    }
    else {
        element[name] = value;
    }
}


export default (attribute: { name: string, value: string }, element: Element, input: unknown) => {
    let data: Data = {
            id: 0,
            name: attribute.name,
            value: attribute.value
        },
        delimiter = delimiters[attribute.name] || '';

    if (typeof input === 'function') {
        data.bucket = (element[ATTRIBUTES] || (element[ATTRIBUTES] = {})) as Record<PropertyKey, unknown>;

        reactive(data, element, ('e' + data.id++), input);
    }
    else if (isArray(input)) {
        let buffer = '',
            effects: Function[] = [];

        for (let i = 0, n = input.length; i < n; i++) {
            let v = input[i];

            if (typeof v === 'function') {
                effects.push(v);
            }
            else if (v === false || v == null) {
            }
            else {
                buffer += (buffer ? delimiter : '') + v;
            }
        }

        if (effects.length === 0) {
            if (buffer === '') {
                return;
            }

            set(data, element, buffer);
        }
        else {
            let last = effects.length - 1;

            data.bucket = (element[ATTRIBUTES] || (element[ATTRIBUTES] = {})) as Record<PropertyKey, unknown>;
            data.value += (buffer && data.value ? delimiter : '') + buffer;

            for (let i = 0; i <= last; i++) {
                reactive(data, element, ('e' + data.id++), effects[i], i !== last);
            }
        }
    }
    else {
        if (input === '') {
            return;
        }

        set(data, element, input);
    }
};