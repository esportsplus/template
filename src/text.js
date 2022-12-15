import { effect } from '@esportsplus/reactivity';


class Text {
    constructor(node) {
        this.node = node || document.createTextNode('');
        this.value = null;
    }


    update(value) {
        if (['null', 'undefined'].includes(`${value}`)) {
            value = '';
        }

        if (this.value == value) {
            return;
        }

        this.node.textContent = (this.value = value);
    }
}


export default (node, value) => {
    let text = new Text(node);

    if (typeof value === 'function') {
        effect(async () => text.update(await value()));
    }
    else {
        text.update(value);
    }

    return text;
};
export { Text };
