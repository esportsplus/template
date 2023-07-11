import { Node, Nodes } from './types';


// TODO: Cache eviction?
let templates: Record<string, () => Nodes> = {};


const after = (anchor: Node, nodes: Nodes) => {
    for (let i = 0, n = nodes.length; i < n; i++) {
        anchor.after(anchor = nodes[i]);
    }

    return nodes;
};

const find = (nodes: Nodes, path: number[], slot: boolean) => {
    let node: Node | null = nodes[path[0]];

    if (!node) {
        return undefined;
    }

    // Skip `i = 0` used the first path index above, skip last if it's a slot
    for (let i = 1, n = path.length - (slot ? 1 : 0); i < n; i++) {
        node = (node as Element).firstElementChild;

        for (let start = 0, end = path[i]; start < end; start++) {
            if (!node) {
                return undefined;
            }

            node = (node as Element).nextElementSibling;
        }
    }

    if (node && slot) {
        node = node.firstChild;

        for (let i = 0, n = path[path.length - 1]; i < n; i++) {
            if (!node) {
                return undefined;
            }

            node = node.nextSibling;
        }
    }

    return node || undefined;
};

const remove = (nodes: Nodes) => {
    for (let i = 0, n = nodes.length; i < n; i++) {
        nodes[i]?.remove();
    }

    return nodes;
};

const template = (html: string) => {
    if (html in templates) {
        return templates[html];
    }

    let template = document.createElement('template');

    template.innerHTML = html;

    return templates[html] = () => {
        let clone = template.content.cloneNode(true);

        clone.normalize();

        return Array.from( clone.childNodes );
    };
};

template.clear = () => {
    templates = {};
};


export default { after, find, remove, template };
export { after, find, remove, template };