import { NODE_CLOSING, NODE_ELEMENT, NODE_SLOT, NODE_TYPES, NODE_VOID, SLOT_ATTRIBUTE_REGEX, SLOT_HTML, SLOT_NODE_REGEX, SLOT_TYPE } from '~/constants';
import { Template } from '~/types';


export default (data: Template) => {
    if (data.expressions == null) {
        return data;
    }

    let attribute = 0,
        attributes: string[] = [],
        html = data.html,
        level = 0,
        levels = [
            {   // Leading text node
                children: (html[0] === '<' ? 0 : 1),
                elements: 0,
                path: [] as number[]
            }
        ],
        remaining = data.expressions.length,
        slots: Template['slots'] = data.slots = [];

    for (let match of html.matchAll(SLOT_ATTRIBUTE_REGEX)) {
        let name = match[1],
            value = match[2];

        for (let i = 0, n = value.length; i < n; i++) {
            if ((i = value.indexOf(SLOT_HTML, i)) === -1) {
                break;
            }

            attributes.push(name);
        }

        if ((name[0] === 'o' && name[1] === 'n') || name === 'src') {
            data.html = data.html.replace(match[0], '');
        }
    }

    for (let match of html.matchAll(SLOT_NODE_REGEX)) {
        let parent = levels[level],
            type = NODE_TYPES[match[1]] || NODE_ELEMENT;

        if (type === NODE_ELEMENT || type === NODE_VOID) {
            let attr = match[2],
                path = parent.path.concat(parent.elements);

            if (attr && attr.indexOf(SLOT_HTML) !== -1) {
                for (let i = 0, n = attr.length; i < n; i++) {
                    if ((i = attr.indexOf(SLOT_HTML, i)) === -1) {
                        break;
                    }

                    remaining--;
                    slots.push({
                        path,
                        type: attributes[attribute++]
                    });
                }
            }

            if (match[3] === undefined && type === NODE_ELEMENT) {
                level++;
            }

            levels[level] = {
                children: 0,
                elements: 0,
                path
            };
            parent.elements++;
        }
        else if (type === NODE_SLOT) {
            remaining--;
            slots.push({
                path: parent.path.concat(parent.children),
                type: SLOT_TYPE
            });
        }

        if (!remaining) {
            break;
        }

        if (type === NODE_CLOSING) {
            level--;
        }
        else {
            parent.children++;
        }

        // Trailing text node
        let char = html[(match.index || 0) + match[0].length];

        if (char && char !== '<') {
            levels[level].children++;
        }
    }

    return data;
};