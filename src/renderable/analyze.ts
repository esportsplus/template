import { NODE_CLOSING, NODE_COMMENT, NODE_ELEMENT, NODE_SLOT, NODE_VOID, SLOT_HTML, SLOT_REGEX, SLOT_TYPE } from '~/constants';
import { Renderable } from './index';


let skip = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr']);


export default ({ expressions, html }: Renderable) => {
    if (expressions == null) {
        return [];
    }

    let cache = [
            {
                // Leading text node
                children: (html[0] === '<' ? 0 : 1),
                elements: 0,
                path: [] as number[]
            }
        ],
        level = 0,
        remaining = expressions.length,
        slots = [];

    for (let match of html.matchAll(SLOT_REGEX)) {
        let parent = cache[level],
            start = (match.index || 0) + match[0].length,
            type = NODE_ELEMENT;

        if (match[0] === SLOT_HTML) {
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
            remaining--;
            slots.push({
                path: parent.path.concat(parent.children),
                type: SLOT_TYPE
            });
        }
        else if (type === NODE_ELEMENT || type === NODE_VOID) {
            let attribute = match[3],
                path = parent.path.concat(parent.elements);

            if (attribute && attribute.indexOf(SLOT_HTML) !== -1) {
                let last = null,
                    type = '';

                for (let i = 0, n = attribute.length; i < n; i += SLOT_HTML.length) {
                    if ((i = attribute.indexOf(SLOT_HTML, i)) === -1) {
                        break;
                    }

                    last = null;
                    type = '';

                    for (let n = i - 1; n >= 0; n--) {
                        let char = attribute[n];

                        if (char === "'" || char === '"') {
                            last = '"';
                        }
                        else if (char === '=' && last === '"') {
                            last = '=';
                        }
                        else if (last === '=') {
                            if (char === ' ' || char === "'" || char === '"') {
                                remaining--;
                                slots.push({ path, type });
                                break;
                            }
                            else {
                                type = char + type;
                            }
                        }
                    }
                }
            }

            if (type === NODE_ELEMENT) {
                level++;
            }

            cache[level] = {
                children: 0,
                elements: 0,
                path
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
            cache[level].children++;
        }

        if (remaining === 0) {
            break;
        }
    }

    return slots;
};