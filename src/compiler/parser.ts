import { ATTRIBUTE_DELIMITERS, SLOT_HTML } from '../constants';
import { PACKAGE_NAME, TYPES } from './constants';


type AttributeMetadata = { clean: string; names: string[]; parts: AttributePart[]; static: Record<string, string> };

type AttributePart = { group: number; prefix: string; suffix: string };

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

const REGEX_CLOSING_TAGS_END = /(?:<\/[a-z][\w-]*>)+$/i;

const REGEX_EMPTY_ATTRIBUTES = /\s+[\w:-]+\s*=\s*["']\s*["']|\s+(?=>)/g;

const REGEX_EMPTY_TEXT_NODES = /(>|}|\s)\s+(<|{|\s)/g;

const REGEX_EVENTS = /(?:\s*on[\w-:]+\s*=(?:\s*["'][^"']*["'])*)/g;

const REGEX_SLOT_ATTRIBUTES = /<([\w-]+)([^><]*{{\$}}[^><]*)>/g;

const REGEX_SLOT_NODES = /<([\w-]+|[\/!])(?:([^><]*{{\$}}[^><]*)|(?:[^><]*))?>|{{\$}}/g;

// Only unquote values in the HTML unquoted-attribute-safe subset AND followed by a proper
// terminator ([\s>]); a value abutting '/>' would swallow the slash into the unquoted value
const REGEX_UNQUOTED_ATTRIBUTE = /([\w:-]+)="([\w./:-]+)"(?=[\s>])/g;

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


// Literal text abutting a slot marker belongs to that slot's value, never to the emitted clone:
// scanning an element's attribute segment hands each run to the marker it touches (as prefix or
// suffix) and rebuilds the segment without it - the run is already in `buffer`, so nothing is
// re-cut out of the source. `group` ties every marker sharing one value (or one class/style token)
// together, so a value carrying several markers still emits a single binding.
function metadata(found: string): AttributeMetadata {
    let attribute = '',
        buffer = '',
        clean = '',
        delimiter = '',
        group = 0,
        names: string[] = [],
        parts: AttributePart[] = [],
        pending = -1,
        quote = '',
        statics: Record<string, string> = {};

    // One past the end: the sentinel closes the trailing value without duplicating the flush
    for (let i = 0, n = found.length; i <= n; i++) {
        let char = i < n ? found[i] : '',
            close = false,
            separate = false;

        if (char === '') {
            close = true;
        }
        else if (char === '{' && found.startsWith(SLOT_MARKER, i)) {
            names.push(attribute || TYPES.Attributes);
            parts.push({ group, prefix: buffer, suffix: '' });

            buffer = '';
            clean += SLOT_MARKER;
            i += SLOT_MARKER.length - 1;
            pending = parts.length - 1;
            continue;
        }
        else if (char === '=' && !quote) {
            attribute = buffer;
            clean += buffer + char;
            buffer = '';
            delimiter = ATTRIBUTE_DELIMITERS[attribute] || '';
            continue;
        }
        else if (char === '"' || char === "'") {
            if (!quote) {
                if (attribute) {
                    quote = char;
                }

                clean += char;
                continue;
            }
            else if (quote === char) {
                close = true;
            }
        }
        else if (char === ' ') {
            if (!quote) {
                close = true;
            }
            else if (delimiter === ' ') {
                separate = true;
            }
        }
        else if (quote && char === delimiter) {
            separate = true;
        }

        if (close || separate) {
            if (pending !== -1) {
                parts[pending].suffix = buffer;
                pending = -1;
            }
            else if (buffer) {
                clean += buffer;

                if (delimiter) {
                    let token = buffer.trim();

                    if (token) {
                        statics[attribute] = statics[attribute] ? statics[attribute] + delimiter + token : token;
                    }
                }
            }

            buffer = '';
            clean += char;
            group++;

            if (close) {
                attribute = '';
                delimiter = '';
                quote = '';
            }

            continue;
        }

        buffer += char;
    }

    return { clean, names, parts, static: statics };
}

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

// Provably DOM-equivalent shrink of the emitted html: the fragment parser auto-closes every open
// element at end of input (so the trailing closing-tag run is redundant) and unquoted values in the
// safe subset parse identically. Mid-stream closing tags are never touched.
function minify(html: string) {
    return html
        .replace(REGEX_CLOSING_TAGS_END, '')
        .replace(REGEX_UNQUOTED_ATTRIBUTE, '$1=$2');
}


const parse = (literals: string[]) => {
    let html = literals
            .join(SLOT_MARKER)
            .replace(REGEX_EMPTY_TEXT_NODES, '$1$2')
            .replace(REGEX_CLEANUP_WHITESPACE, ' ')
            .trim(),
        n = literals.length - 1;

    if (n === 0) {
        return { html: minify(html), slots: null };
    }

    let cache: Record<string, AttributeMetadata> = {},
        metas: AttributeMetadata[] = [];

    // Every pass below (node walk, slot paths, emitted clone) reads html AFTER the text owned by
    // an attribute binding is gone, so no downstream pass has to re-cut it back out. Elements are
    // rewritten in document order, which is the order the node walk consumes their metadata in.
    html = html.replace(REGEX_SLOT_ATTRIBUTES, (_, name: string, found: string) => {
        let meta = cache[found] ??= metadata(found);

        metas.push(meta);

        return '<' + name + meta.clean + '>';
    });

    let buffer = '',
        cursor = 0,
        index = 0,
        level = 0,
        levels = [{ children: 0, elements: 0, path: [] as NodePath }],
        parsed = html.split(SLOT_MARKER),
        pending: { level: typeof levels[number]; offset: number; ordinal: number; slot: number }[] = [],
        slot = 0,
        slots: (
            { mode?: 'last' | 'sole'; path: NodePath; type: TYPES.Node } |
            { attributes: AttributeMetadata; path: NodePath; type: TYPES.Attribute }
        )[] = [];

    {
        for (let match of html.matchAll(REGEX_SLOT_NODES)) {
            let parent = levels[level],
                type = match[1] === undefined ? NODE_SLOT : (
                    NODE_WHITELIST[match[1].toLowerCase()] ||
                    (match[0].at(-2) === '/' ? NODE_VOID : NODE_ELEMENT)
                );

            if ((match.index ?? 0) > index) {
                parent.children++;
            }

            if (type === NODE_ELEMENT || type === NODE_VOID) {
                let attr = match[2],
                    path = parent.path.length
                        ? methods(parent.elements, parent.path, 'firstElementChild', 'nextElementSibling')
                        : methods(parent.children, [], 'firstChild', 'nextSibling');

                if (attr) {
                    let attrs = metas[cursor++];

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
                buffer += parsed[slot++];

                let offset = buffer.length;

                buffer += SLOT_HTML;
                pending.push({ level: parent, offset, ordinal: parent.children, slot: slots.length });
                slots.push({
                    path: methods(parent.children, parent.path, 'firstChild', 'nextSibling'),
                    type: TYPES.Node
                });
            }

            if (n === slot) {
                buffer += parsed[slot++];
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

    {
        let elide: number[] = [];

        for (let i = 0, m = pending.length; i < m; i++) {
            let p = pending[i];

            if (p.level.path.length === 0 || p.ordinal !== p.level.children - 1) {
                continue;
            }

            let node = slots[p.slot];

            if (node.type !== TYPES.Node) {
                continue;
            }

            node.mode = p.level.children === 1 ? 'sole' : 'last';
            node.path = p.level.path.slice();
            elide.push(p.offset);
        }

        if (elide.length) {
            elide.sort((a, b) => b - a);

            for (let i = 0, m = elide.length; i < m; i++) {
                let offset = elide[i];

                buffer = buffer.slice(0, offset) + buffer.slice(offset + SLOT_HTML.length);
            }
        }
    }

    buffer = buffer
        .replace(REGEX_EVENTS, '')
        .replace(REGEX_EMPTY_ATTRIBUTES, '')
        .replace(REGEX_CLEANUP_WHITESPACE, ' ');

    return {
        html: minify(buffer),
        slots: slots.length ? slots : null
    };
};


export default { minify, parse };
export type { AttributeMetadata, AttributePart };
