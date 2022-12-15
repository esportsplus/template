export default (nodelist: Element[]) => {
    for (let i = 0, n = nodelist.length; i < n; i++) {
        nodelist[i]?.remove();
    }

    return nodelist;
};
