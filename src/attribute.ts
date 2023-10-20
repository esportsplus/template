import { effect, root, DIRTY } from '@esportsplus/reactivity';
import { ATTRIBUTES } from './constants';
import { Element } from './types';
import { className, isArray, removeAttribute, setAttribute } from './utilities';
import raf from './raf';


let delimiters: Record<string, string> = {
        class: ' ',
        style: ';'
    },
    id = 0;


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

function reactive(data: { name: string, value: string }, element: Element, id: string, input: unknown) {
    if (typeof input === 'function') {
        effect((self) => {
            let v = (input as Function)();

            if (typeof v === 'function') {
                root(() => {
                    reactive(data, element, id, v());
                });
            }
            else if (self.state === DIRTY) {
                reactive(data, element, id, v);
            }
            else {
                raf.add(() => {
                    reactive(data, element, id, v);
                });
            }
        });

        return;
    }

    let { name } = data,
        bucket = (element[ATTRIBUTES] || (element[ATTRIBUTES] = {})) as Record<PropertyKey, unknown>;

    if (name in delimiters) {
        let cache = (bucket[name] || (bucket[name] = {})) as Record<PropertyKey, null>,
            delimiter = delimiters[name],
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
        if (bucket[name] === input) {
            return;
        }

        bucket[name] = input as string;
    }

    set(data, element, input);
}

function set(data: { name: string, value: string }, element: Element, input: unknown) {
    if (input === false || input == null) {
        return;
    }

    let { name } = data,
        delimiter = delimiters[name] || '',
        value = data.value + (input ? delimiter : '') + input;

    if (data.value === value) {
        return;
    }

    if (value === '') {
        removeAttribute.call(element, name);
    }
    else if (name === 'class') {
        className.call(element, value);
    }
    else if ((name[0] === 'd' && name.slice(0, 5) === 'data-') || name === 'style') {
        setAttribute.call(element, name, value);
    }
    else {
        element[name] = value;
    }
}


export default (data: { name: string, value: string }, element: Element, input: unknown) => {
    if (typeof input === 'function') {
        reactive(data, element, ('e' + id++), input);
    }
    else if (isArray(input)) {
        let { name } = data,
            delimiter = delimiters[name] || '',
            effects: Function[] = [],
            value = '';

        for (let i = 0, n = input.length; i < n; i++) {
            let v = input[i];

            if (typeof v === 'function') {
                effects.push(v);
            }
            else if (v === false || v == null) {
            }
            else {
                value += (value ? delimiter : '') + v;
            }
        }

        if (effects.length === 0) {
            if (value === '') {
                return;
            }

            set(data, element, value);
        }
        else {
            data = {
                name,
                value: data.value + (data.value ? delimiter : '') + value
            };

            for (let i = 0, n = effects.length; i < n; i++) {
                reactive(data, element, ('e' + id++), effects[i]);
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