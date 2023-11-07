import { EMPTY_ARRAY } from './constants';
import { Element, Elements } from './types';
import { firstChild, fragment, nextSibling } from './utilities';
import a from './attribute';
import e from './event';
import s from './slot';


let cache = new WeakMap<TemplateStringsArray, Template>();


class Template {
    fragment: DocumentFragment | boolean = false;
    html: string;
    slots: {
        data: {
            fn: typeof a | typeof e | typeof s;
            n: number;
            name: string;
            value: string;
        };
        path: typeof firstChild[];
    }[];


    constructor(html: string, slots: Template['slots']) {
        this.html = html;
        this.slots = slots;
    }


    clone() {
        if (typeof this.fragment === 'boolean') {
            if (this.fragment) {
                this.fragment = fragment(this.html);
            }
            else {
                this.fragment = true;

                return fragment(this.html);
            }
        }

        return (this.fragment as DocumentFragment).cloneNode(true);
    }

    render(values: unknown[]) {
        let fragment = this.clone(),
            slots = this.slots;

        if (slots.length) {
            let node,
                previous,
                v = values.length - 1;

            for (let i = slots.length - 1; i >= 0; i--) {
                let { data, path } = slots[i];

                if (path === previous) {
                }
                else {
                    node = fragment;
                    previous = path;

                    for (let o = 0, j = path.length; o < j; o++) {
                        node = path[o].call(node as Element);
                    }
                }

                if (data.n === 1) {
                    data.fn(data, node as Element, values[v--]);
                }
                else {
                    let copy: unknown[] = [];

                    for (let o = 0, j = data.n; o < j; o++) {
                        copy.push(values[v--]);
                    }

                    data.fn(data, node as Element, copy);
                }
            }
        }

        let nodes: Elements = [];

        for (let n = firstChild.call(fragment as Element); n; n = nextSibling.call(n)) {
            nodes.push(n);
        }

        return nodes;
    }
}


const get = (literals: TemplateStringsArray) => {
    let template = cache.get(literals);

    if (template !== undefined && template.fragment === false) {
        template.fragment = true;
    }

    return template;
};

const set = (literals: TemplateStringsArray, html: string, slots: Template['slots'] = EMPTY_ARRAY) => {
    let template = new Template(html, slots);

    cache.set(literals, template);

    return template;
};


export { get, set, Template };