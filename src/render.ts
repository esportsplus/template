import { SLOT, SLOT_TYPE } from './constants';
import { attribute, node } from './reactive';
import { Template } from './types';
import { find } from './dom';
import renderable from './renderable';
import slot, { Slot } from './slot';


export default (input: Template, parent: HTMLElement | Slot) => {
    let s;

    if (SLOT in parent) {
        s = parent;
    }
    else {
        s = slot();
        parent.prepend( s.anchor() );
    }

    let { expressions, nodes, slots } = renderable(input);

    s.render(nodes);

    if (!expressions) {
        return;
    }

    for (let i = 0, n = slots.length; i < n; i++) {
        let { path, type } = slots[i],
            host = find(nodes, path, type === SLOT_TYPE);

        if (host == null) {
            throw new Error('Template: invalid node path');
        }

        if (type === SLOT_TYPE) {
            node(host, expressions[i]);
        }
        else {
            attribute(host as HTMLElement, type, expressions[i]);
        }
    }
};