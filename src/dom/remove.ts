const remove = (nodes?: ChildNode[]) => {
    if (nodes === undefined || nodes.length === 0) {
        return undefined;
    }

    for (let i = 0, n = nodes.length; i < n; i++) {
        nodes[i].remove();
    }

    return nodes;
};

remove.groups = (groups: (ChildNode[])[]) => {
    if (groups.length === 0) {
        return groups;
    }

    for (let i = 0, n = groups.length; i < n; i++) {
        let nodes = groups[i];

        for (let j = 0, o = nodes.length; j < o; j++) {
            nodes[j].remove();
        }
    }

    return groups;
};


export default remove;