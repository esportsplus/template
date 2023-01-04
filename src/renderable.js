import { parse } from './parser';
import dom from './dom';
import slots from './slots';
import template from './template';


let cache = {},
    level = 0;


function Renderable(obj) {
    let { content, slots } = parse(obj.content);

    this.nodes = dom.template(content);
    this.slots = slots;
    this.template = obj.template;
    this.type = obj.type;
}

Renderable.prototype = {
    render: function(slot, values) {
        level++;

        if (this.type === 'template') {
            for (let i = 0, n = values.length; i < n; i++) {
                template.i++;
                slot.push(slots(this.nodes(), this.slots, this.template(values[i], i).values));
                template.i--;
            }

            values.effects({
                delete: slot.delete,
                pop: slot.pop,
                push: (...values) => {
                    for (let i = 0, n = values.length; i < n; i++) {
                        template.i++;
                        slot.push(slots(this.nodes(), this.slots, this.template(values[i], i).values));
                        template.i--;
                    }
                },
                set: (index, values) => {
                    template.i++;
                    slot.set(index, slots(this.nodes(), this.slots, this.template(values, index).values));
                    template.i--;
                },
                shift: slot.shift,
                splice: (index, remove = 0, ...values) => {
                    let cursor = index - 2;

                    if (remove > 1) {
                        slot.delete(index, remove);
                    }

                    for (let i = 0, n = values.length; i < n; i++) {
                        template.i++;
                        slot.after(cursor + i, slots(this.nodes(), this.slots, this.template(values[i], i).values));
                        template.i--;
                    }
                },
                unshift: (...values) => {
                    for (let i = values.length - 1; i >= 0; i--) {
                        template.i++;
                        slot.unshift(slots(this.nodes(), this.slots, this.template(values[i], i).values));
                        template.i--;
                    }
                }
            });
        }
        else {
            slot.push(slots(this.nodes(), this.slots, values));
        }

        if (--level < 1) {
            cache = {};
        }

        return slot;
    }
};


export default (obj) => {
    if (!['html', 'template'].includes(obj.type)) {
        throw new Error('Invalid OBJ type provided to renderer!');
    }

    return cache[obj.content] || (cache[obj.content] = new Renderable(obj));
};
