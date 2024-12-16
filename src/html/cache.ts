import {
    NODE_CLOSING, NODE_ELEMENT, NODE_SLOT, NODE_VOID, NODE_WHITELIST, REGEX_EVENTS,
    REGEX_SLOT_ATTRIBUTES, REGEX_SLOT_NODES, REGEX_WHITESPACE, SLOT_HTML, SLOT_MARKER
} from '~/constants';
import { RenderableStatic, Template } from '~/types';
import { firstChild, firstElementChild, isArray, isInlineable, nextElementSibling, nextSibling } from '~/utilities';
import a from '~/attributes';
import s from '~/slot';


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

    // TODO: Test regex find all tags with slots, iterate through and cache info in object with html as key
    for (let match of html.matchAll(REGEX_SLOT_ATTRIBUTES)) {
        let name = match[1] || null,
            value = (match[2] || match[0]).trim();

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
            type = match[1] === undefined ? NODE_SLOT : (NODE_WHITELIST[match[1].toLowerCase()] || NODE_ELEMENT);

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

                    if (name == null) {
                        slots.push({ fn: a.spread, name, path, slot });
                    }
                    else {
                        let value = values[slot];

                        if (isInlineable(value)) {
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

            if (isInlineable(value)) {
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
    return html.replace(REGEX_WHITESPACE, '$1$2').trim();
}

function set(literals: TemplateStringsArray, html: string, slots: Template['slots'] = null) {
    let template = { fragment: false, html, literals, slots };

    cache.set(literals, template);

    return template;
}


const get = ({ literals, values }: RenderableStatic, level: number) => {
    let template;

    if (level !== 0) {
        for (let i = templates.length - 1; i >= 0; i--) {
            if (templates[i].literals === literals) {
                template = templates[i];
                break;
            }
        }
    }
    else {
        templates.length = 0;
    }

    if (template === undefined) {
        template = cache.get(literals) || build(literals, values);

        if (level !== 0) {
            templates.push(template);
        }
    }

    if (template.fragment === false) {
        template.fragment = true;
    }

    return template;
};


export default { get };