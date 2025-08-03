import {
    NODE_CLOSING, NODE_ELEMENT, NODE_SLOT, NODE_VOID, NODE_WHITELIST, REGEX_EMPTY_TEXT_NODES,
    REGEX_SLOT_NODES, SLOT_HTML, SLOT_MARKER, SLOT_MARKER_LENGTH
} from '~/constants';
import { RenderableTemplate, Template } from '~/types';
import { firstChild, firstElementChild, fragment, nextElementSibling, nextSibling } from '~/utilities';
import { spread } from '~/attributes';
import s from '~/slot';


let cache = new WeakMap<TemplateStringsArray, Template>();


function build(literals: TemplateStringsArray, values: unknown[]) {
    if (values.length === 0) {
        return set(literals, literals[0]);
    }

    let buffer = '',
        html = literals.join(SLOT_MARKER)
            .replace(REGEX_EMPTY_TEXT_NODES, '$1$2')
            .trim(),
        index = 0,
        level = 0,
        levels = [{
            children: 0,
            elements: 0,
            path: [] as NonNullable<Template['slots']>[0]['path']
        }],
        parsed = html.split(SLOT_MARKER),
        slot = 0,
        slots: Template['slots'] = [],
        total = values.length;

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
                let i = attr.indexOf(SLOT_MARKER),
                    path = methods(parent.children, parent.path, firstChild, nextSibling);

                while (i !== -1) {
                    slots.push({
                        fn: spread,
                        path,
                        slot
                    });

                    buffer += parsed[slot++];
                    i = attr.indexOf(SLOT_MARKER, i + SLOT_MARKER_LENGTH);
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
            buffer += parsed[slot] + SLOT_HTML;
            slots.push({
                fn: s,
                path: methods(parent.children, parent.path, firstChild, nextSibling),
                slot: slot++
            });
        }

        if (slot === total) {
            buffer += parsed[slot];
            break;
        }

        if (type === NODE_CLOSING) {
            level--;

            // TODO: support multiple root nodes in template literals
        }
        else {
            parent.children++;
        }

        index = (match.index || 0) + match[0].length;
    }

    return set(literals, buffer, slots);
}

function methods(children: number, copy: (typeof firstChild)[], first: (typeof firstChild), next: (typeof firstChild)) {
    let methods = copy.slice();

    methods.push(first);

    for (let start = 0; start < children; start++) {
        methods.push(next);
    }

    return methods;
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