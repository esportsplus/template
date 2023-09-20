const after = (anchor: ChildNode, nodes: ChildNode[]) => {
    anchor.after(...nodes);
    return nodes;
};

after.groups = (anchor: ChildNode, groups: (ChildNode[])[]) => {
    for (let i = 0, n = groups.length; i < n; i++) {
        anchor.after(...groups[i]);
    }

    return groups;
};


export default after;