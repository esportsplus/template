import {
    NODE_CLOSING, NODE_ELEMENT, NODE_SLOT, NODE_VOID, NODE_WHITELIST, REGEX_EVENTS, REGEX_EMPTY_TEXT_NODES,
    REGEX_SLOT_ATTRIBUTES, REGEX_SLOT_NODES, REGEX_WHITESPACE, RENDERABLE,
    RENDERABLE_INLINE, RENDERABLE_TEMPLATE, SLOT_HTML, SLOT_MARKER
} from './constants';
import { Element, Elements, Renderable, Template } from './types';
import { cloneNode, firstChild, firstElementChild, fragment, isArray, nextElementSibling, nextSibling } from './utilities';
import a from './attributes';
import s from './slot';


let cache = new WeakMap<TemplateStringsArray, Template>(),
    templates: Template[] = [];


function build(literals: TemplateStringsArray, values: unknown[]) {
    if (values.length === 0) {
        return set(literals, literals[0]);
    }

    let attribute = 0,
        attributes: (null | string)[] = [],
        buffer = '',
        html = minify(literals.join(SLOT_MARKER)),
        index = 0,
        level = 0,
        levels = [{
            children: 0,
            elements: 0,
            path: [] as NonNullable<Template['slots']>[0]['path']
        }],
        slot = 0,
        slots: Template['slots'] = [],
        total = values.length;

    for (let match of html.matchAll(REGEX_SLOT_ATTRIBUTES)) {
        let name = match[1] || null,
            value = match[2] || match[0];

        if (value === SLOT_MARKER) {
            attributes.push(name);
        }
        else {
            for (let i = 0, n = value.length; i < n; i++) {
                if ((i = value.indexOf(SLOT_MARKER, i)) === -1) {
                    break;
                }

                attributes.push(name);
            }
        }
    }

    for (let match of html.matchAll(REGEX_SLOT_NODES)) {
        let parent = levels[level],
            type = match[1] === undefined ? NODE_SLOT : (NODE_WHITELIST[match[1]] || NODE_ELEMENT);

        // Text nodes
        if ((match.index || 1) - 1 > index) {
            parent.children++;
        }

        if (type === NODE_ELEMENT || type === NODE_VOID) {
            let attr = match[2];

            if (attr) {
                let path = methods(parent.children, parent.path, firstChild, nextSibling);

                for (let i = 0, n = attr.length; i < n; i++) {
                    if ((i = attr.indexOf(SLOT_MARKER, i)) === -1) {
                        break;
                    }

                    let name = attributes[attribute++];

                    if (name === null) {
                        slots.push({ fn: a.spread, name, path, slot });
                    }
                    else {
                        let value = values[slot];

                        if (inlineable(value)) {
                            buffer += literals[slot++] + flatten(value.literals, value.values);
                            continue;
                        }
                        else {
                            slots.push({ fn: a.set, name, path, slot });
                        }
                    }

                    buffer += literals[slot++];
                }
            }

            if (type === NODE_ELEMENT) {
                levels[++level] = {
                    children: 0,
                    elements: 0,
                    path: parent.path.length
                        ? methods(parent.elements, parent.path, firstElementChild, nextElementSibling)
                        : methods(parent.children, [], firstChild, nextSibling)
                };
            }

            parent.elements++;
        }
        else if (type === NODE_SLOT) {
            let value = values[slot];

            if (inlineable(value)) {
                buffer += literals[slot++] + flatten(value.literals, value.values);
            }
            else {
                buffer += literals[slot] + SLOT_HTML;
                slots.push({
                    fn: s,
                    name: null,
                    path: methods(parent.children, parent.path, firstChild, nextSibling),
                    slot: slot++
                });
            }
        }

        if (slot === total) {
            buffer += literals[slot];
            break;
        }

        if (type === NODE_CLOSING) {
            level--;
        }
        else {
            parent.children++;
        }

        index = (match.index || 0) + match[0].length;
    }

    return set(literals, minify(buffer.replace(REGEX_EVENTS, '')), slots);
}

function clone(template: Template) {
    if (typeof template.fragment === 'boolean') {
        if (template.fragment === true) {
            template.fragment = fragment(template.html);
        }
        else {
            template.fragment = true;

            return fragment(template.html);
        }
    }

    return cloneNode.call(template.fragment, true);
}

function flatten(literals: TemplateStringsArray, values: unknown[]) {
    let html = '',
        value;

    for (let i = 0, n = literals.length; i < n; i++) {
        html += (literals[i] || '') + (
            isArray(value = values[i] || '') ? value.join('') : value
        );
    }

    return html;
}

function get(renderable: Renderable, level: number) {
    let { literals, values } = renderable,
        template;

    if (level) {
        if (templates.length) {
            for (let i = templates.length - 1; i >= 0; i--) {
                if (templates[i].literals === literals) {
                    template = templates[i];
                    break;
                }
            }
        }
    }
    else {
        templates = [];
    }

    if (template === undefined) {
        template = cache.get(literals) || build(literals, values);

        if (level) {
            templates.push(template);
        }
    }

    if (template.fragment === false) {
        template.fragment = true;
    }

    return template;
}

function inlineable(value: unknown): value is Renderable {
    return typeof value === 'object' && value !== null && (value as Record<PropertyKey, unknown>)[RENDERABLE] === RENDERABLE_INLINE;
}

function methods(children: number, copy: (typeof firstChild)[], first: (typeof firstChild), next: (typeof firstChild)) {
    let methods = [];

    for (let i = 0, n = copy.length; i < n; i++) {
        methods.push(copy[i]);
    }

    methods.push(first);

    for (let start = 0; start < children; start++) {
        methods.push(next);
    }

    return methods;
}

function minify(html: string) {
    return html.replace(REGEX_EMPTY_TEXT_NODES, '$1$2').replace(REGEX_WHITESPACE, ' ').trim();
}

function set(literals: TemplateStringsArray, html: string, slots: Template['slots'] = null) {
    let template = { fragment: false, html, literals, slots };

    cache.set(literals, template);

    return template;
}


const html = (literals: TemplateStringsArray, ...values: unknown[]): Renderable => {
    return { [RENDERABLE]: RENDERABLE_TEMPLATE, literals, template: null, values };
};

html.inline = (literals: TemplateStringsArray, ...values: unknown[]): Renderable => {
    return { [RENDERABLE]: RENDERABLE_INLINE, literals, template: null, values };
};

const hydrate = (renderable: Renderable, level: number) => {
    let template = renderable.template || (renderable.template = get(renderable, level));

    let elements: Elements = [],
        fragment = clone(template),
        slots = template.slots;

    if (slots !== null) {
        let node,
            previous,
            values = renderable.values;

        for (let i = slots.length - 1; i >= 0; i--) {
            let { fn, name, path, slot } = slots[i];

            if (path === previous) {}
            else {
                a.apply(node);

                node = fragment;
                previous = path;

                for (let o = 0, j = path.length; o < j; o++) {
                    node = path[o].call(node as Element);
                }
            }

            // @ts-ignore
            fn(node, values[slot], name);
        }

        a.apply(node);
    }

    for (let element = firstChild.call(fragment as Element); element; element = nextSibling.call(element)) {
        elements.push(element);
    }

    return elements;
};


export default html;
export { hydrate };