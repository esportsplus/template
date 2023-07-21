import { effect } from '@esportsplus/reactivity';
import { TEMPLATE } from './constants';
import { Slot } from './slot';
import { Node as N, Template } from './types';
import render from './render';
import slot from './slot';


class Node {
    node: Text | null = null;
    slot: Slot;
    value: string | null = null;


    constructor(slot: Slot) {
        this.slot = slot;
    }


    update(value: unknown) {
        if (typeof value === 'function') {
            effect(async () => {
                this.update( await (value as Function)() );
            });
        }
        else if (typeof value === 'object' && value !== null && TEMPLATE in value) {
            if (this.node !== null) {
                this.node = null;
                this.value = null;
            }

            render(value as Template, this.slot);
        }
        else {
            value = value?.toString() || '';

            if (value === 'false' || value === 'null' || value === 'undefined') {
                value = '';
            }

            if (this.value === value) {
                return;
            }

            this.value = value as string;

            if (this.node === null) {
                this.node = document.createTextNode(this.value);
                this.slot.render([ [this.node] ]);
            }
            else if (this.value !== value) {
                this.node.textContent = this.value;
            }
        }

        return this;
    }
}


export default (node: N, value: unknown) => {
    return new Node( slot(node) ).update(value);

};
export { Node };
