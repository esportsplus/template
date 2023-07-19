import { SLOT_TYPE_NODE } from './constants';
import { find, template } from './dom';
import { analyze } from './html';
import { Template } from './types';
import slot, { Slot } from './slot';
import attribute from './attribute';
import node from './node';


let level = 0;


export default (data: Template, instance?: Slot) => {
    let nodes = template( analyze(data).content )();

    if (data.slots !== undefined) {
        let { expressions, slots } = data;

        level++;

        for (let i = 0, n = slots.length; i < n; i++) {
            let { path, type } = slots[i],
                element = find(nodes, path, type === SLOT_TYPE_NODE);

            if (element === undefined) {
                throw new Error(`Template: invalid node path`);
            }

            if (type === SLOT_TYPE_NODE) {
                node(element, expressions?.[i]);
            }
            else {
                attribute(element as HTMLElement, type, expressions?.[i]);
            }
        }

        level--;

        if (level < 1) {
            template.clear();
        }
    }

    return (instance || slot()).render([ nodes ]);
};