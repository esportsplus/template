import { effect, DIRTY } from '@esportsplus/reactivity';
import { CLASS, SLOT_HTML, STYLE } from '~/constants';
import { events } from '~/dom';
import { EventListener } from '~/types';
import { toString } from '~/utilities';
import raf from '~/raf';


let delimiters = {
        class: ' ',
        style: ';'
    };


function normalize(key: keyof typeof delimiters, value: null | string | undefined) {
    let cache: ReactiveAttributeList['cache'] = {};

    if (value == null) {
        return cache;
    }

    let expressions = value.split(delimiters[key]);

    for (let i = 0, n = expressions.length; i < n; i ++) {
        let key = toString(expressions[i]);

        if (key === '') {
            continue;
        }

        cache[key] = null;
    }

    return cache;
}


class ReactiveAttribute {
    dataset: boolean;
    element: HTMLElement;
    type: string;
    value: string | null = null;


    constructor(element: HTMLElement, type: string) {
        this.dataset = type.slice(0, 5) === 'data-';
        this.element = element;
        this.type = type;
    }


    update(value: unknown) {
        value = toString(value);

        if (this.value === value) {
            return;
        }

        if (value === '') {
            this.element.removeAttribute(this.type);
        }
        else if (this.dataset === true) {
            this.element.setAttribute(this.type, value as string);
        }
        else {
            // @ts-ignore
            this.element[this.type] = value;
        }

        this.value = value as string;

        return this;
    }
}

class ReactiveAttributeList {
    cache: Record<PropertyKey, null>;
    element: HTMLElement;
    type: 'class' | 'style';
    value: ReactiveAttributeList['cache'] = {};


    constructor(element: HTMLElement & Record<PropertyKey, any>, type: ReactiveAttributeList['type']) {
        let cache = element[type === 'class' ? CLASS : STYLE];

        if (!cache) {
            let value = element.getAttribute(type);

            if (value && value.indexOf(SLOT_HTML) !== -1) {
                for (let i = 0, n = value.length; i < n; i += SLOT_HTML.length) {
                    if ((i = value.indexOf(SLOT_HTML, i)) === -1) {
                        break;
                    }

                    value = value.replace(SLOT_HTML, '');
                }
            }

            cache = normalize(type, value);
        }

        this.cache = cache;
        this.element = element;
        this.type = type;
    }


    update(value: unknown) {
        let a = this.value,
            b = normalize(this.type, value?.toString()),
            cache = this.cache;

        for (let key in b) {
            if (key in cache) {
                continue;
            }

            cache[key] = null;
        }

        for (let key in a) {
            if (key in b) {
                continue;
            }

            delete cache[key];
        }

        this.element.setAttribute(this.type, Object.keys(cache).join(delimiters[this.type]));
        this.value = b;

        return this;
    }
}


export default (element: HTMLElement, type: string, value: unknown) => {
    let instance: ReactiveAttribute | ReactiveAttributeList;

    if (type === 'class' || type === 'style') {
        instance = new ReactiveAttributeList(element, type);
    }
    else {
        instance = new ReactiveAttribute(element, type);
    }

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
            effect((self) => {
                let v = value();

                if (self.state === DIRTY) {
                    instance.update(v);
                }
                else {
                    raf.add(() => {
                        instance.update(v);
                    });
                }
            });
        }
    }
    else {
        instance.update(value);
    }

    return instance;
};
export { ReactiveAttribute, ReactiveAttributeList };
