import { SLOT_HTML } from '../shared-constants';


const ATTRIBUTE_DELIMITERS: Record<string, string> = {
    class: ' ',
    style: ';'
};

const NODE_CLOSING = 1;

const NODE_COMMENT = 2;

const NODE_ELEMENT = 3;

const NODE_SLOT = 4;

const NODE_VOID = 5;

const NODE_WHITELIST: Record<string, number> = {
    '/': NODE_CLOSING,
    '!': NODE_COMMENT,

    'area': NODE_VOID,
    'base': NODE_VOID,
    'br': NODE_VOID,
    'col': NODE_VOID,
    'embed': NODE_VOID,
    'hr': NODE_VOID,
    'img': NODE_VOID,
    'input': NODE_VOID,
    'keygen': NODE_VOID,
    'link': NODE_VOID,
    'menuitem': NODE_VOID,
    'meta': NODE_VOID,
    'param': NODE_VOID,
    'source': NODE_VOID,
    'track': NODE_VOID,
    'wbr': NODE_VOID
};

const REGEX_EMPTY_TEXT_NODES = /(>|}|\s)\s+(<|{|\s)/g;

const REGEX_EVENTS = /(?:\s*on[\w-:]+\s*=(?:\s*["'][^"']*["'])*)/g;

const REGEX_SLOT_ATTRIBUTES = /<[\w-]+([^><]*{{\$}}[^><]*)>/g;

const REGEX_SLOT_NODES = /<([\w-]+|[\/!])(?:([^><]*{{\$}}[^><]*)|(?:[^><]*))?>|{{\$}}/g;

const SLOT_MARKER = '{{$}}';


type NodePath = ('firstChild' | 'firstElementChild' | 'nextElementSibling' | 'nextSibling')[];


function methods(children: number, copy: NodePath, first: NodePath[number], next: NodePath[number]) {
    let length = copy.length,
        methods: NodePath = new Array(length + 1 + children);

    for (let i = 0, n = length; i < n; i++) {
        methods[i] = copy[i];
    }

    methods[length] = first;

    for (let i = 0, n = children; i < n; i++) {
        methods[length + 1 + i] = next;
    }

    return methods;
}


const parse = (literals: string[]) => {
    let html = literals.join(SLOT_MARKER)
            .replace(REGEX_EMPTY_TEXT_NODES, '$1$2')
            .trim(),
        n = literals.length - 1;

    if (n === 0) {
        return {
            html,
            slots: null
        };
    }

    let attributes: Record<string, { names: string[], statics: Record<string, string> }> = {},
        buffer = '',
        events = false,
        index = 0,
        level = 0,
        levels = [{
            children: 0,
            elements: 0,
            path: [] as NodePath
        }],
        parsed = html.split(SLOT_MARKER),
        slot = 0,
        slots: (
            {
                path: NodePath;
                type: 'slot';
            } | {
                attributes: typeof attributes[string];
                path: NodePath;
                type: 'attributes';
            }
        )[] = [];

    {
        let attribute = '',
            buffer = '',
            char = '',
            quote = '';

        for (let match of html.matchAll(REGEX_SLOT_ATTRIBUTES)) {
            let found = match[1];

            if (attributes[found]) {
                continue;
            }

            let { names, statics } = attributes[found] = {
                    names: [],
                    statics: {}
                } as typeof attributes[string];

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
                        continue;
                    }
                    else if (!quote) {
                        quote = char;
                    }
                    else if (quote === char) {
                        if (attribute) {
                            statics[attribute] ??= '';
                            statics[attribute] += `${ATTRIBUTE_DELIMITERS[attribute] || ''}${buffer}`;
                        }

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
                            names.push(attribute);

                            if (!quote) {
                                attribute = '';
                            }
                        }
                        else {
                            names.push('spread');
                        }
                    }
                    else if (buffer === 'on') {
                        events = true;
                    }
                }
            }
        }
    }

    {
        for (let match of html.matchAll(REGEX_SLOT_NODES)) {
            let parent = levels[level],
                type = match[1] === undefined ? NODE_SLOT : (NODE_WHITELIST[match[1].toLowerCase()] || NODE_ELEMENT);

            // Text nodes
            if ((match.index || 1) - 1 > index) {
                parent.children++;
            }

            if (type === NODE_ELEMENT || type === NODE_VOID) {
                let attr = match[2],
                    path = parent.path.length
                        ? methods(parent.elements, parent.path, 'firstElementChild', 'nextElementSibling')
                        : methods(parent.children, [], 'firstChild', 'nextSibling');

                if (attr) {
                    let attrs = attributes[attr];

                    if (!attrs) {
                        throw new Error(`@esportsplus/template: attribute metadata could not be found for '${attr}'`);
                    }

                    slots.push({
                        attributes: attrs,
                        path,
                        type: 'attributes'
                    });

                    for (let i = 0, n = attrs.names.length; i < n; i++) {
                        buffer += parsed[slot++];
                    }
                }

                if (type === NODE_ELEMENT) {
                    levels[++level] = {
                        children: 0,
                        elements: 0,
                        path
                    };
                }

                parent.elements++;
            }
            else if (type === NODE_SLOT) {
                buffer += parsed[slot++] + SLOT_HTML;
                slots.push({
                    path: methods(parent.children, parent.path, 'firstChild', 'nextSibling'),
                    type: 'slot',
                });
            }

            if (n === slot) {
                buffer += parsed[slot];
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
    }

    if (events) {
        buffer = buffer.replace(REGEX_EVENTS, '');
    }

    return {
        html: buffer,
        slots: slots.length ? slots : null
    };
}


export default { parse };