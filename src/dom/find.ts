// `stringToHTML` returns cloned child nodes
export default (nodes: Element[], path: number[] = []) => {
    let node: Element | undefined = nodes[ path[0] ];

    for (let i = 1, n = path.length; i < n; i++) {
        node = node?.firstChild as Element | undefined;

        for (let start = 0, end = path[i]; start < end; start++) {
            node = node?.nextSibling as Element | undefined;
        }

        if (!node) {
            return undefined;
        }
    }

    return node;
};
