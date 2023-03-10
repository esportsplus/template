import { effect } from '@esportsplus/reactivity';


let cache = new WeakMap();


class ClassName {
    constructor(node) {
        this.node = node;
        this.value = null;
    }


    update(value) {
        if (this.value == value) {
            return;
        }

        let add = value ? value.split(' ') : [],
            list = cache.get(this.node),
            remove = this.value ? this.value.split(' ') : [];

        if (!list) {
            cache.set(
                this.node,
                (list = new Set( this.node.getAttribute('class').split(' ').filter(Boolean) ))
            );
        }

        for (let i = 0, n = remove.length; i < n; i++) {
            if (!remove[i]) {
                continue;
            }

            list.delete(remove[i]);
        }

        for (let i = 0, n = add.length; i < n; i++) {
            if (!add[i]) {
                continue;
            }

            list.add(add[i]);
        }

        this.node.setAttribute('class', [...list.values()].join(' '));
        this.value = value;
    }
}


export default (node, value) => {
    let classname = new ClassName(node);

    if (typeof value === 'function') {
        effect(async () => classname.update( await value(node) ));
    }
    else if (value = `${value}`.trim()) {
        node.setAttribute('class', `${node.getAttribute('class')} ${value}`);
    }

    return classname;
};
export { ClassName };
