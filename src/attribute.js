import { effect } from '~/app';
import events from '@esportsplus/delegated-events';


function Attribute(node, type) {
    this.node = node;
    this.type = type;
    this.value = null;
}

Attribute.prototype = {
    update: function(value) {
        if (this.value == value) {
            return;
        }

        if (['false', 'null', 'undefined'].includes(`${value}`)) {
            this.node.removeAttribute(this.type);
        }
        else if (['id', 'value'].includes(this.type)) {
            this.node[this.type] = value;
        }
        else {
            this.node.setAttribute(this.type, value);
        }

        this.value = value;
    }
};


export default (node, type, value) => {
    let attribute = new Attribute(node, type);

    if (typeof value === 'function') {
        if (type.startsWith('on')) {
            events.register(node, type.slice(2), value);
            node.removeAttribute(type);
        }
        else {
            effect(async () => attribute.update( await value(node) ));
        }
    }
    else {
        attribute.update(value);
    }

    return attribute;
};
export { Attribute };
