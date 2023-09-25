import { effect, DIRTY } from '@esportsplus/reactivity';
import { ATTRIBUTES, SLOT_HTML } from '~/constants';
import { events } from '~/dom';
import { EventListener } from '~/types';
import { toString } from '~/utilities';
import raf from '~/raf';


let delimiters = {
        class: ' ',
        style: ';'
    },
    i = 0;


function read(element: HTMLElement, key: keyof typeof delimiters) {
    let value = element.getAttribute(key);

    if (value && value.indexOf(SLOT_HTML) !== -1) {
        for (let i = 0, n = value.length; i < n; i += SLOT_HTML.length) {
            if ((i = value.indexOf(SLOT_HTML, i)) === -1) {
                break;
            }

            value = value.replace(SLOT_HTML, '');
        }
    }

    return normalize(key, value);
}

function normalize(key: keyof typeof delimiters, value: unknown) {
    let cache: Attributes['cache'][keyof Attributes['cache']] = {};

    if (typeof value === 'string') {
        let values = value.split(delimiters[key]);

        for (let i = 0, n = values.length; i < n; i ++) {
            let value = toString(values[i]).trim();

            if (value === '') {
                continue;
            }

            cache[value] = null;
        }
    }

    return cache;
}


class Attributes {
    cache: Record<PropertyKey, Record<PropertyKey, null>> = {};
    element: HTMLElement;
    previous: Record<PropertyKey, unknown> = {};


    constructor(element: Attributes['element']) {
        this.element = element;
    }


    attribute(_: unknown, type: string, value: unknown) {
        value = toString(value);

        if (this.previous[type] === value) {
            return;
        }

        this.previous[type] = value;

        if (value === '') {
            this.element.removeAttribute(type);
        }
        else if (type.slice(0, 5) === 'data-') {
            this.element.setAttribute(type, value as string);
        }
        else {
            // @ts-ignore
            this.element[type] = value;
        }
    }

    list(key: string, type: keyof typeof delimiters, value: unknown) {
        let a = this.previous[key] || undefined,
            b = normalize(type, value?.toString()),
            cache = this.cache[type] || (this.cache[type] = read(this.element, type));

        for (let add in b) {
            if (add in cache) {
                continue;
            }

            cache[add] = null;
        }

        if (typeof a === 'object') {
            for (let remove in a) {
                if (remove in b) {
                    continue;
                }

                delete cache[remove];
            }
        }

        this.element.setAttribute(type, Object.keys(cache).join(delimiters[type]));

        if (key !== 'e0') {
            this.previous[key] = b;
        }
    }
}


export default (element: HTMLElement & Record<PropertyKey, any>, type: string, value: unknown) => {
    let instance = element[ATTRIBUTES] || (element[ATTRIBUTES] = new Attributes(element)),
        method = type in delimiters ? 'list' : 'attribute';

    if (typeof value === 'function') {
        if (type.slice(0, 2) === 'on') {
            if (type === 'onrender') {
                value(element);
            }
            else {
                events.register(element, type.slice(2), value as EventListener);
            }
        }
        else {
            let key = 'e' + (++i);

            effect((self) => {
                let v = value();

                if (self.state === DIRTY) {
                    instance[method](key, type, v);
                }
                else {
                    raf.add(() => {
                        instance[method](key, type, v);
                    });
                }
            });
        }
    }
    else {
        instance[method]('e0', type, value);
    }
};