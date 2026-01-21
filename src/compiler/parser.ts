import { ATTRIBUTE_DELIMITERS, SLOT_HTML } from '../constants';
import { PACKAGE_NAME, TYPES } from './constants';


type NodePath = ('firstChild' | 'firstElementChild' | 'nextElementSibling' | 'nextSibling')[];


const NODE_CLOSING = 1;

const NODE_COMMENT = 2;

const NODE_ELEMENT = 3;

const NODE_SLOT = 4;

const NODE_VOID = 5;

const NODE_WHITELIST: Record<string, number> = {
    '!': NODE_COMMENT,
    '/': NODE_CLOSING
};

const REGEX_CLEANUP_WHITESPACE = /\s+/g;

const REGEX_EMPTY_ATTRIBUTES = /\s+[\w:-]+\s*=\s*["']\s*["']|\s+(?=>)/g;

const REGEX_EMPTY_TEXT_NODES = /(>|}|\s)\s+(<|{|\s)/g;

const REGEX_EVENTS = /(?:\s*on[\w-:]+\s*=(?:\s*["'][^"']*["'])*)/g;

const REGEX_SLOT_ATTRIBUTES = /<[\w-]+([^><]*{{\$}}[^><]*)>/g;

const REGEX_SLOT_NODES = /<([\w-]+|[\/!])(?:([^><]*{{\$}}[^><]*)|(?:[^><]*))?>|{{\$}}/g;

const SLOT_MARKER = '{{$}}';


[
    // html
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr',

    // svg
    'animate', 'animateMotion', 'animateTransform', 'circle', 'ellipse',
    'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix',
    'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feDropShadow', 'feFlood',
    'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMergeNode',
    'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
    'hatch', 'hatchpath', 'image', 'line', 'mpath', 'path', 'polygon', 'polyline',
    'rect', 'set', 'stop', 'use', 'view'
].map(tag => NODE_WHITELIST[tag] = NODE_VOID);


function methods(children: number, copy: NodePath, first: NodePath[number], next: NodePath[number]) {
    let length = copy.length,
        result: NodePath = new Array(length + 1 + children);

    for (let i = 0, n = length; i < n; i++) {
        result[i] = copy[i];
    }

    result[length] = first;

    for (let i = 0, n = children; i < n; i++) {
        result[length + 1 + i] = next;
    }

    return result;
}


const parse = (literals: string[]) => {
    let html = literals
            .join(SLOT_MARKER)
            .replace(REGEX_EMPTY_TEXT_NODES, '$1$2')
            .replace(REGEX_CLEANUP_WHITESPACE, ' ')
            .trim(),
        n = literals.length - 1;

    if (n === 0) {
        return { html, slots: null };
    }

    let attributes: Record<string, { names: string[], static: Record<string, string> }> = {},
        buffer = '',
        index = 0,
        level = 0,
        levels = [{ children: 0, elements: 0, path: [] as NodePath }],
        parsed = html.split(SLOT_MARKER),
        slot = 0,
        slots: (
            { path: NodePath; type: TYPES.Node } |
            { attributes: typeof attributes[string]; path: NodePath; type: TYPES.Attribute }
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

            let { names, static: s } = attributes[found] = { names: [], static: {} } as typeof attributes[string];

            for (let i = 0, n = found.length; i < n; i++) {
                char = found[i];

                if (char === ' ') {
                    if (attribute && attribute in ATTRIBUTE_DELIMITERS) {
                        s[attribute] ??= '';
                        s[attribute] += char + buffer;
                    }

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
                        if (attribute && attribute in ATTRIBUTE_DELIMITERS) {
                            s[attribute] ??= '';
                            s[attribute] += ` ${buffer}`;
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
                            names.push(TYPES.Attributes);
                        }
                    }
                }
            }
        }
    }

    {
        for (let match of html.matchAll(REGEX_SLOT_NODES)) {
            let parent = levels[level],
                type = match[1] === undefined ? NODE_SLOT : (
                    NODE_WHITELIST[match[1].toLowerCase()] ||
                    (match[0].at(-2) === '/' ? NODE_VOID : NODE_ELEMENT)
                );

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
                        throw new Error(`${PACKAGE_NAME}: attribute metadata could not be found for '${attr}'`);
                    }

                    slots.push({ attributes: attrs, path, type: TYPES.Attribute });

                    for (let i = 0, n = attrs.names.length; i < n; i++) {
                        buffer += parsed[slot++];
                    }
                }

                if (type === NODE_ELEMENT) {
                    levels[++level] = { children: 0, elements: 0, path };
                }

                parent.elements++;
            }
            else if (type === NODE_SLOT) {
                buffer += parsed[slot++] + SLOT_HTML;
                slots.push({
                    path: methods(parent.children, parent.path, 'firstChild', 'nextSibling'),
                    type: TYPES.Node
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

    buffer = buffer
        .replace(REGEX_EVENTS, '')
        .replace(REGEX_EMPTY_ATTRIBUTES, '')
        .replace(REGEX_CLEANUP_WHITESPACE, ' ');

    return {
        html: buffer,
        slots: slots.length ? slots : null
    };
};


export default { parse };
