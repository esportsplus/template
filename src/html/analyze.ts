import { NODE_CLOSING, NODE_COMMENT, NODE_ELEMENT, NODE_SLOT, NODE_VOID, SLOT_ATTRIBUTE_REGEX, SLOT_HTML, SLOT_NODE_REGEX, SLOT_TYPE } from '~/constants';
import { Template } from '~/types';


let skip = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr']);


export default (data: Template) => {
    if (data.expressions == null) {
        return data;
    }

    let attribute = 0,
        attributes: string[] = [],
        html = data.html,
        level = 0,
        levels = [
            {
                // Leading text node
                children: (html[0] === '<' ? 0 : 1),
                elements: 0,
                path: [] as number[]
            }
        ],
        remaining = data.expressions.length,
        slots: NonNullable<Template['slots']> = data.slots = [];

    for (let match of html.matchAll(SLOT_ATTRIBUTE_REGEX)) {
        let name = match[1],
            value = match[2];

        for (let i = 0, n = value.length; i < n; i += SLOT_HTML.length) {
            if ((i = value.indexOf(SLOT_HTML, i)) === -1) {
                break;
            }

            attributes.push(name);
        }

        if (name.slice(0, 2) === 'on') {
            data.html = data.html.replace(match[0], '');
        }
    }

    for (let match of html.matchAll(SLOT_NODE_REGEX)) {
        let parent = levels[level],
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
            let attr = match[3],
                path = parent.path.concat(parent.elements);

            if (attr && attr.indexOf(SLOT_HTML) !== -1) {
                for (let i = 0, n = attr.length; i < n; i += SLOT_HTML.length) {
                    if ((i = attr.indexOf(SLOT_HTML, i)) === -1) {
                        break;
                    }

                    slots.push({
                        path,
                        type: attributes[attribute++]
                    });
                }
            }

            if (type === NODE_ELEMENT) {
                level++;
            }

            levels[level] = {
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
            levels[level].children++;
        }

        if (remaining === 0) {
            break;
        }
    }

    return data;
};