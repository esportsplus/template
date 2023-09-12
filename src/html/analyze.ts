import {
    NODE_CLOSING, NODE_COMMENT, NODE_ELEMENT, NODE_SLOT, NODE_VOID,
    REGEX_SLOT_ATTRIBUTES, REGEX_SLOT_TAGS, REGEX_TAG_WHITESPACE, REGEX_WHITESPACE,
    SLOT, SLOT_TYPE_NODE
} from '~/constants';
import { Template } from '~/types';


let skip = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr']);


export default (data: Template) => {
    if (data.expressions === undefined) {
        return data;
    }

    data.content = data.content
        .replace(REGEX_WHITESPACE, ' ')
        .replace(REGEX_TAG_WHITESPACE, '><')
        .trim();
    data.slots = [];

    let cache: {
            children: number;
            elements: number;
            path: number[] | null;
        }[] = [],
        html = '<div>' + data.content + '</div>',
        level = -1,
        slots: string[] = [],
        total = data.expressions.length;

    // Attribute slots
    for (let match of html.matchAll(REGEX_SLOT_ATTRIBUTES)) {
        let name = match[1],
            value = match[2];

        for (let i = 0, n = value.length; i < n; i += SLOT.length) {
            if ((i = value.indexOf(SLOT, i)) === -1) {
                break;
            }

            slots.push(name);
        }
    }

    // Node slots
    for (let match of html.matchAll(REGEX_SLOT_TAGS)) {
        let parent = (cache[level] || { children: 0, elements: 0, path: null }),
            start = (match.index === undefined ? 0 : match.index) + match[0].length,
            type = NODE_ELEMENT;

        if (match[0] === SLOT) {
            type = NODE_SLOT;
        }
        else if (match[1] === '/') {
            type = NODE_CLOSING;
        }
        else if (match[1] === '!') {
            type = NODE_COMMENT;
        }
        else if (match[4] === '/' || skip.has(match[2])) {
            type = NODE_VOID;
        }

        if (type === NODE_SLOT) {
            data.slots.push({
                path: (parent.path === null ? [parent.children] : parent.path.concat(parent.children)),
                type: SLOT_TYPE_NODE
            });
        }
        else if (type === NODE_ELEMENT || type === NODE_VOID) {
            let attributes = match[3];

            if (type === NODE_ELEMENT) {
                level++;
            }

            if (attributes && attributes.indexOf(SLOT) !== -1) {
                for (let i = 0, n = attributes.length; i < n; i += SLOT.length) {
                    if ((i = attributes.indexOf(SLOT, i)) === -1) {
                        break;
                    }

                    data.slots.push({
                        path: (parent.path === null ? [parent.elements] : parent.path.concat(parent.elements)),
                        type: (slots.shift() || '')
                    });
                }
            }

            cache[level] = {
                children: 0,
                elements: 0,
                // Skip div wrapper on `html`
                path: level > 0 ? (parent.path === null ? [parent.elements] : parent.path.concat(parent.elements)) : null
            };
            parent.elements++;
        }

        if (type === NODE_CLOSING) {
            level--;
        }
        else {
            parent.children++;
        }

        // Trailing text node
        if (html[start] && html[start] !== '<') {
            let end = html.indexOf('<', start);

            if (end !== -1 && html.slice(start, end) !== ' ') {
                cache[Math.max(level, 0)].children++;
            }
        }

        if (data.slots.length >= total) {
            break;
        }
    }

    return data;
};
