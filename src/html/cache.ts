import {
    NODE_CLOSING, NODE_ELEMENT, NODE_SLOT, NODE_VOID, NODE_WHITELIST, REGEX_EMPTY_TEXT_NODES, REGEX_EVENTS, REGEX_EXTRA_WHITESPACE,
    REGEX_SLOT_ATTRIBUTES, REGEX_SLOT_NODES, SLOT_HTML, SLOT_MARKER
} from '~/constants';
import { RenderableTemplate, Template } from '~/types';
import { firstChild, firstElementChild, fragment, nextElementSibling, nextSibling } from '~/utilities';
import a from '~/attributes';
import s from '~/slot';


let cache = new WeakMap<TemplateStringsArray, Template>();


function build(literals: TemplateStringsArray, values: unknown[]) {
    if (values.length === 0) {
        return set(literals, literals[0]);
    }

    let attributes: Record<string, (null | string)[]> = {},
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

    {
        let attribute = '',
            buffer = '',
            char = '',
            quote = '';

        for (let match of html.matchAll(REGEX_SLOT_ATTRIBUTES)) {
            let found = match[1],
                metadata = attributes[found];

            if (metadata) {
                continue;
            }

            metadata = attributes[found] = [];

            for (let i = 0, n = found.length; i < n; i++) {
                char = found[i];

                if (char === ' ') {
                    buffer = '';
                }
                else if (char === '=') {
                    attribute = buffer;
                    buffer = '';
                }
                else if (char === '"' || char === "'") {
                    if (!attribute) {
                    }
                    else if (!quote) {
                        quote = char;
                    }
                    else if (quote === char) {
                        attribute = '';
                        buffer = '';
                        quote = '';
                    }
                }
                else if (char === '{' && char !== buffer) {
                    buffer = char;
                }
                else {
                    buffer += char;

                    if (buffer === SLOT_MARKER) {
                        buffer = '';

                        if (attribute) {
                            metadata.push(attribute);

                            if (!quote) {
                                attribute = '';
                            }
                        }
                        else {
                            metadata.push(null);
                        }
                    }
                }
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
                let metadata = attributes[attr],
                    path = methods(parent.children, parent.path, firstChild, nextSibling);

                if (!metadata) {
                    throw new Error(`Template: attribute metadata could not be found for '${attr}'`);
                }

                for (let i = 0, n = metadata.length; i < n; i++) {
                    let name = metadata[i];

                    slots.push({
                        fn: name === null ? a.spread : a.set,
                        name,
                        path,
                        slot
                    });

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
            buffer += literals[slot] + SLOT_HTML;
            slots.push({
                fn: s,
                name: null,
                path: methods(parent.children, parent.path, firstChild, nextSibling),
                slot: slot++
            });
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

function methods(children: number, copy: (typeof firstChild)[], first: (typeof firstChild), next: (typeof firstChild)) {
    let methods = copy.slice();

    methods.push(first);

    for (let start = 0; start < children; start++) {
        methods.push(next);
    }

    return methods;
}

function minify(html: string) {
    return html.replace(REGEX_EMPTY_TEXT_NODES, '$1$2').replace(REGEX_EXTRA_WHITESPACE, ' ').trim();
}

function set(literals: TemplateStringsArray, html: string, slots: Template['slots'] = null) {
    let template = {
            fragment: fragment(html),
            html,
            literals,
            slots
        };

    cache.set(literals, template);

    return template;
}


const get = <T>({ literals, values }: RenderableTemplate<T>) => {
    return cache.get(literals) || build(literals, values);
};


export default { get };