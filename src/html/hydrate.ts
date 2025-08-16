import { Fragment, RenderableValues, Template } from '~/types';
import { cloneNode } from '~/utilities/node';


export default ({ fragment, slots }: Template, values: RenderableValues[]): Fragment => {
    let clone = cloneNode.call(fragment, true);

    if (slots === null) {
        return clone as Fragment;
    }

    let node,
        nodePath,
        parent,
        parentPath;

    for (let i = 0, n = slots.length; i < n; i++) {
        let { fn, path, slot } = slots[i],
            pp = path.parent,
            pr = path.relative;

        if (pp !== parentPath) {
            if (pp === nodePath) {
                parent = node;
                parentPath = nodePath;

                nodePath = undefined;
            }
            else {
                parent = clone;
                parentPath = pp;

                for (let i = 0, n = pp.length; i < n; i++) {
                    parent = pp[i].call(parent);
                }
            }
        }

        if (pr !== nodePath) {
            node = parent;
            nodePath = path.absolute;

            for (let i = 0, n = pr.length; i < n; i++) {
                node = pr[i].call(node);
            }
        }

        // @ts-ignore
        fn(node, values[slot]);
    }

    return clone as Fragment;
}