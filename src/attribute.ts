import events, { Listener } from '@esportsplus/delegated-events';
import { effect } from '@esportsplus/reactivity';
import { SLOT } from './constants';


type List = Record<PropertyKey, null>;


let delimiters: Record<string, string> = {
        class: ' ',
        style: ';'
    },
    wm = new WeakMap<HTMLElement, { class?: List, style?: List }>();


function normalize(cache: List, type: string, value: string) {
    let values = value.split(delimiters[type]);

    for (let i = 0, n = values.length; i < n; i ++) {
        let key = values[i];

        if (!key || key === SLOT || key === 'false' || key === 'null' || key === 'undefined') {
            continue;
        }

        cache[key] = null;
    }

    return cache;
}


class Attribute {
    type: string;
    node: HTMLElement;
    value: string | null = null;


    constructor(node: HTMLElement, type: string) {
        this.type = type;
        this.node = node;
    }


    update(value: unknown) {
        value = value?.toString() || '';

        if (this.value === value) {
            return;
        }

        if (value === '' || value === 'false' || value === 'null' || value === 'undefined') {
            this.node.removeAttribute(this.type);
            value = '';
        }
        else if (this.type === 'id' || this.type === 'value') {
            // @ts-ignore
            this.node[this.type] = value;
        }
        else {
            this.node.setAttribute(this.type, value as string);
        }

        this.value = value as string;

        return this;
    }
}

class AttributeList {
    cache: List;
    node: HTMLElement;
    type: 'class' | 'style';
    value: List = {};


    constructor(cache: AttributeList['cache'], type: AttributeList['type'], node: HTMLElement) {
        this.cache = cache;
        this.type = type;
        this.node = node;
    }


    update(value: unknown) {
        let cache = this.cache,
            replacement = normalize({}, this.type, (value?.toString() || ''));

        for (let key in replacement) {
            if (key in cache) {
                continue;
            }

            cache[key] = null;
        }

        for (let key in this.value) {
            if (key in replacement) {
                continue;
            }

            delete cache[key];
        }

        this.node.setAttribute(this.type, Object.keys(cache).join(delimiters[this.type]));
        this.value = replacement;

        return this;
    }
}


export default (node: HTMLElement, type: string, value: unknown) => {
    let instance: Attribute | AttributeList;

    if (type === 'class' || type === 'style') {
        let cache = wm.get(node) || {};

        if (!(type in cache)) {
            wm.set( node, cache[type] = normalize({}, type, (node.getAttribute(type) || '')) );
        }

        instance = new AttributeList(cache[type]!, type, node);
    }
    else {
        instance = new Attribute(node, type);
    }

    if (typeof value === 'function') {
        if (type.startsWith('on')) {
            if (type === 'onrender') {
                value(node);
            }
            else {
                events.register(node, type.slice(2), value as Listener);
            }

            node.removeAttribute(type);
        }
        else {
            effect(async () => {
                instance.update( await value() );
            });
        }
    }
    else {
        instance.update(value);
    }

    return instance;
};
export { Attribute, AttributeList };
