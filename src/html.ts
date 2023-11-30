import {
    EMPTY_ARRAY,
    NODE_CLOSING, NODE_ELEMENT, NODE_SLOT, NODE_TYPES, NODE_VOID,
    RENDERABLE,
    SLOT_ATTRIBUTE_REGEX, SLOT_HTML, SLOT_NODE_REGEX, SLOT_REPLACE_REGEX,
    TEMPLATE_CLEANUP_REGEX, TEMPLATE_NORMALIZE_REGEX
} from './constants';
import { get, set, Template } from './template';
import { Renderable } from './types';
import { firstChild, firstElementChild, isArray, nextElementSibling, nextSibling } from './utilities';
import a from './attribute';
import s from './slot';


let data = { fn: s, n: 1, name: 'node', value: '' };


function build(literals: TemplateStringsArray, values: unknown[]) {
    if (values.length === 0) {
        return set(literals, literals[0]);
    }

    let attribute = 0,
        attributes: Template['slots'][0]['data'][] = [],
        html = literals
            .join(SLOT_HTML)
            .replace(TEMPLATE_NORMALIZE_REGEX, '$1$2')
            .trim(),
        level = 0,
        levels = [
            {   // Leading text node
                children: (html[0] === '<' ? 0 : 1),
                elements: 0,
                path: [] as (typeof firstChild)[]
            }
        ],
        remaining = values.length,
        slots: Template['slots'] = [],
        template = html.replace(TEMPLATE_CLEANUP_REGEX, '');

    for (let match of html.matchAll(SLOT_ATTRIBUTE_REGEX)) {
        let data: typeof slots[0]['data'] = {
                fn: a,
                n: 0,
                name: match[1],
                value: match[2] || match[3]
            },
            value = data.value;

        for (let i = 0, n = value.length; i < n; i++) {
            if ((i = value.indexOf(SLOT_HTML, i)) === -1) {
                break;
            }

            attributes.push(data);
            data.n++;
        }

        data.value = value === SLOT_HTML ? '' : value.replace(SLOT_REPLACE_REGEX, '');
    }

    for (let match of html.matchAll(SLOT_NODE_REGEX)) {
        let parent = levels[level],
            type = NODE_TYPES[match[1]] || NODE_ELEMENT;

        if (type === NODE_ELEMENT || type === NODE_VOID) {
            let attr = match[2],
                path = parent.path.concat( sibling(parent.children) );

            if (attr && attr.indexOf(SLOT_HTML) !== -1) {
                let previous;

                for (let i = 0, n = attr.length; i < n; i++) {
                    if ((i = attr.indexOf(SLOT_HTML, i)) === -1) {
                        break;
                    }

                    let data = attributes[attribute++];

                    if (data === previous) {
                    }
                    else {
                        previous = data;
                        slots.push({ data, path });
                    }

                    remaining--;
                }
            }

            if (match[3] === undefined && type === NODE_ELEMENT) {
                level++;
            }

            levels[level] = {
                children: 0,
                elements: 0,
                path: parent.path.length
                    ? parent.path.concat( element(parent.elements) )
                    : sibling(parent.children)
            };
            parent.elements++;
        }
        else if (type === NODE_SLOT) {
            remaining--;
            slots.push({
                data,
                path: parent.path.concat( sibling(parent.children) )
            });
        }

        if (!remaining) {
            break;
        }

        if (type === NODE_CLOSING) {
            level--;
        }
        else {
            parent.children++;
        }

        // Trailing text node
        let char = html[(match.index || 0) + match[0].length];

        if (char && char !== '<') {
            levels[level].children++;
        }
    }

    return set(literals, template, slots);
}

function element(stop: number) {
    let methods = [firstElementChild];

    for (let start = 0; start < stop; start++) {
        methods.push(nextElementSibling);
    }

    return methods;
}

function flatten(value: unknown) {
    if (value === false || value == null) {
        return '';
    }
    else if (typeof value === 'object') {
        if (RENDERABLE in value) {
            return (value as Renderable).template.html;
        }
        else if (isArray(value)) {
            let html = '';

            for (let i = 0, n = value.length; i < n; i++) {
                html += flatten(value[i]);
            }

            return html;
        }
    }

    return value;
}

function sibling(stop: number) {
    let methods = [firstChild];

    for (let start = 0; start < stop; start++) {
        methods.push(nextSibling);
    }

    return methods;
}


const html = (literals: TemplateStringsArray, ...values: unknown[]): Renderable => {
    return {
        [RENDERABLE]: null,
        template: get(literals) || build(literals, values),
        values
    };
};

html.static = (literals: TemplateStringsArray, ...values: unknown[]): Renderable => {
    let template = get(literals);

    if (!template) {
        let html = '';

        for (let i = 0, n = literals.length; i < n; i++) {
            html += literals[i] + flatten(values[i]);
        }

        template = set(
            literals,
            html.replace(TEMPLATE_NORMALIZE_REGEX, '$1$2').trim()
        );
    }

    return {
        [RENDERABLE]: null,
        template,
        values: EMPTY_ARRAY
    };
};


export default html;