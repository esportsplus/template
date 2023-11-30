import { effect, root, DIRTY } from '@esportsplus/reactivity';
import { ATTRIBUTES, ATTRIBUTES_COUNTER } from './constants';
import { Element } from './types';
import { className, isArray, raf, removeAttribute, setAttribute } from './utilities';
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
                raf.add(() => {
                    reactive(element, id, v, name, value, wait);
                });
            }
        });
        wait = false;
        return;
    }

    let data = store(element);

    if (name in delimiters) {
        let cache = (data[name] || (data[name] = {})) as Record<PropertyKey, null>,
            delimiter = delimiters[name] || '',
            fresh = normalize(name as keyof typeof delimiters, input),
            stale = data[id];

        data[id] = fresh;

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
        if (data[name] === input && wait === false) {
            return;
        }

        data[name] = input as string;
    }

    if (wait === false) {
        set(element, input, name, value);
    }
}

function set(element: Element, input: unknown, name: string, value: string) {
    if (input === false || input == null) {
        input = '';
    }
    else if (input && value) {
        value += delimiters[name] || '';
    }

    value += input;

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

function store(element: Element) {
    return (
        element[ATTRIBUTES] || (element[ATTRIBUTES] = { [ATTRIBUTES_COUNTER]: 0 })
    ) as Record<PropertyKey, unknown> & { [ATTRIBUTES_COUNTER]: number };
}


export default function attribute(element: Element, input: unknown, name: string, value: string) {
    let delimiter = delimiters[name] || '';

    if (typeof input === 'function') {
        if (name[0] === 'o' && name[1] === 'n') {
            event(element, name, input);
        }
        else {
            reactive(element, ('e' + store(element)[ATTRIBUTES_COUNTER]++), input, name, value);
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
            let data = store(element),
                n = effects.length - 1;

            value += (buffer && value ? delimiter : '') + buffer;

            for (let i = 0; i <= n; i++) {
                reactive(element, ('e' + data[ATTRIBUTES_COUNTER]++), effects[i], name, value, i !== n);
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