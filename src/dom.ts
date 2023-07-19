import { Node, Nodes } from './types';


// TODO:
// - Better cache eviction?
let templates: Record<string, () => Nodes> = {};


const after = (anchor: Node, nodes: Nodes) => {
    for (let i = 0, n = nodes.length; i < n; i++) {
        anchor.after(anchor = nodes[i]);
    }

    return nodes;
};

after.groups = (anchor: Node, groups: Nodes[]) => {
    for (let i = 0, n = groups.length; i < n; i++) {
        let nodes = groups[i];

        for (let j = 0, o = nodes.length; j < o; j++) {
            anchor.after(anchor = nodes[j]);
        }
    }

    return groups;
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
            if (node === null) {
                return undefined;
            }

            node = (node as Element).nextElementSibling;
        }
    }

    if (node !== null && slot) {
        node = node.firstChild;

        for (let i = 0, n = path[path.length - 1]; i < n; i++) {
            if (node === null) {
                return undefined;
            }

            node = node.nextSibling;
        }
    }

    return node === null ? undefined : node;
};

const remove = (nodes?: Nodes) => {
    if (nodes === undefined) {
        return undefined;
    }

    for (let i = 0, n = nodes.length; i < n; i++) {
        nodes[i]?.remove();
    }

    return nodes;
};

remove.groups = (groups: Nodes[]) => {
    for (let i = 0, n = groups.length; i < n; i++) {
        let nodes = groups[i];

        for (let j = 0, o = nodes.length; j < o; j++) {
            nodes[j]?.remove();
        }
    }

    return groups;
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