import { effect, root, DIRTY } from '@esportsplus/reactivity';
import { ATTRIBUTES } from './constants';
import { Element } from './types';
import { className, isArray, requestAnimationFrame, removeAttribute, setAttribute } from './utilities';
import event from './event';


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

function reactive(element: Element, id: string, input: unknown, name: string, value: string, wait = false) {
    if (typeof input === 'function') {
        effect((self) => {
            let v = (input as Function)();

            if (typeof v === 'function') {
                root(() => {
                    reactive(element, id, v(), name, value, wait);
                });
            }
            else if (self.state === DIRTY) {
                reactive(element, id, v, name, value, wait);
            }
            else {
                requestAnimationFrame.add(() => {
                    reactive(element, id, v, name, value, wait);
                });
            }
        });
        wait = false;
        return;
    }

    let bucket = (element[ATTRIBUTES] || (element[ATTRIBUTES] = {})) as Record<PropertyKey, unknown>;

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
        set(element, input, name, value);
    }
}

function set(element: Element, input: unknown, name: string, value: string) {
    if (input === false || input == null) {
        return;
    }

    let v = value + (value && input ? (delimiters[name] || '') : '') + input;

    if (v === value) {
        return;
    }

    if (v === '') {
        removeAttribute.call(element, name);
    }
    else if (name === 'class') {
        className.call(element, v);
    }
    else if ((name[0] === 'data' && name.slice(0, 5) === 'data-') || name === 'style') {
        setAttribute.call(element, name, v);
    }
    else {
        element[name] = v;
    }
}


export default function attribute(element: Element, input: unknown, name: string, value: string) {
    let delimiter = delimiters[name] || '',
        id = 0;

    if (typeof input === 'function') {
        if (name[0] === 'o' && name[1] === 'n') {
            event(element, name, input);
        }
        else {
            reactive(element, ('e' + id++), input, name, value);
        }
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

            set(element, buffer, name, value);
        }
        else {
            let last = effects.length - 1;

            value += (buffer && value ? delimiter : '') + buffer;

            for (let i = 0; i <= last; i++) {
                reactive(element, ('e' + id++), effects[i], name, value, i !== last);
            }
        }
    }
    else if (name === '...') {
        for (let key in input as Record<PropertyKey, unknown>) {
            attribute(element, (input as Record<PropertyKey, unknown>)[key], key, '');
        }
    }
    else {
        if (input === '') {
            return;
        }

        set(element, input, name, value);
    }
};