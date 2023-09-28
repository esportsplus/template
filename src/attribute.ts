import { effect, DIRTY } from '@esportsplus/reactivity';
import { ATTRIBUTES } from '~/constants';
import { Element } from './types';
import { toString } from '~/utilities';
import raf from '~/raf';


let delimiters = {
        class: ' ',
        style: ';'
    };


function normalize(key: keyof typeof delimiters, value: unknown) {
    let cache: Record<PropertyKey, null> = {};

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
    element: Element;
    i = 0;
    previous: Record<PropertyKey, unknown> = {};


    constructor(element: Attributes['element']) {
        this.element = element;
    }


    attribute(_: string, type: string, value: unknown) {
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

    list(id: string, type: keyof typeof delimiters, value: unknown) {
        if (type in this.previous === false) {
            this.previous[type] = normalize(type, this.element.getAttribute(type));
        }

        let cache = this.previous[type] as Record<PropertyKey, null>,
            fresh = normalize(type, value?.toString()),
            stale = this.previous[id];

        if (id !== '') {
            this.previous[id] = fresh;
        }

        for (let key in fresh) {
            if (key in cache) {
                continue;
            }

            cache[key] = null;
        }

        if (typeof stale === 'object') {
            for (let key in stale) {
                if (key in fresh) {
                    continue;
                }

                delete cache[key];
            }
        }

        let delimiter = delimiters[type],
            list = '';

        for (let value in cache) {
            list += value + delimiter;
        }

        if (type === 'class') {
            this.element.className = list;
        }
        else {
            // @ts-ignore
            this.element.style = list;
        }
    }
}


export default (element: Element, type: string, value: unknown) => {
    let instance = element[ATTRIBUTES] || (element[ATTRIBUTES] = new Attributes(element)),
        method = type in delimiters ? 'list' : 'attribute';

    if (typeof value === 'function') {
        // @ts-ignore
        let id = 'e' + instance.i++;

        effect((self) => {
            let v = value();

            if (self.state === DIRTY) {
                // @ts-ignore
                instance[method](id, type, v);
            }
            else {
                raf.add(() => {
                    // @ts-ignore
                    instance[method](id, type, v);
                });
            }
        });
    }
    else {
        // @ts-ignore
        instance[method]('', type, value);
    }

    return instance;
};