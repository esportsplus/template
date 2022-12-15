import { find } from './dom';
import classname from './classname';
import attribute from './attribute';
import node from './node';
import slot from './slot';


export default (nodes, slots, values) => {
    for (let i = 0, n = slots.length; i < n; i++) {
        let n = find(nodes, slots[i].path);

        if (slots[i].type === 'class') {
            classname(n, values[i]);
        }
        else if (slots[i].type === 'node') {
            node(slot(n), values[i]);
        }
        else {
            attribute(n, slots[i].type, values[i]);
        }
    }

    return nodes;
};
