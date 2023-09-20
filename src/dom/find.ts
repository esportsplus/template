export default (nodes: ChildNode[], path: number[], slot: boolean) => {
    let total = path.length - 1;

    if (total === 0 && slot) {
        return nodes[path[0]];
    }

    let first: keyof Element = 'firstElementChild',
        next: keyof Element = 'nextElementSibling',
        node;

    for (let i = 0; i <= total; i++) {
        if (i === 0) {
            node = nodes[0];

            if (node.nodeType !== 1) {
                node = (node as Element).nextElementSibling;
            }
        }
        else {
            if (i === total && slot) {
                first = 'firstChild';
                next = 'nextSibling';
            }

            node = (node as Element)[first];
        }

        for (let start = 0, stop = path[i]; start < stop; start++) {
            if (node == null) {
                return node;
            }

            node = (node as Element)[next];
        }
    }

    return node;
};