export default (anchor: Element, nodelist: Element[]) => {
    for (let i = 0, n = nodelist.length; i < n; i++) {
        anchor.after(anchor = nodelist[i]);
    }

    return nodelist;
};
