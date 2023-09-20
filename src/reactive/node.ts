import { effect, root, DIRTY } from '@esportsplus/reactivity';
import { TEMPLATE } from '~/constants';
import { Slot } from '~/slot';
import { Template } from '~/types';
import { isArray, toString } from '~/utilities';
import html from '~/html';
import raf from '~/raf';
import render from '~/render';
import slot from '~/slot';


class ReactiveNode {
    node: Text | null = null;
    slot: Slot;
    value: string | null = null;


    constructor(slot: Slot) {
        this.slot = slot;
    }


    update(value: unknown) {
        if (value == null) {
        }
        else if (typeof value === 'function') {
            effect((self) => {
                let v = (value as Function)();

                if (typeof v === 'function') {
                    root(() => {
                        this.update(v());
                    });
                }
                else if (self.state === DIRTY) {
                    this.update(v);
                }
                else {
                    raf.add(() => {
                        this.update(v);
                    });
                }
            });

            return this;
        }
        else if (typeof value === 'object') {
            this.node = null;
            this.value = null;

            if (TEMPLATE in value) {
                render(value as Template, this.slot);
            }
            else if (isArray(value)) {
                render(
                    html.slot(value),
                    this.slot
                );
            }
            // instanceof is slow...
            else if (value instanceof NodeList) {
                this.slot.render(Array.from(value) as ChildNode[]);
            }
            else if (value instanceof Node) {
                this.slot.render([value] as ChildNode[]);
            }
            else {
                throw new Error(`Template: renderable objects must be an array, node, nodelist, or template ${JSON.stringify(value)}`);
            }

            return this;
        }

        value = toString(value);

        if (this.value === value) {
            return;
        }

        this.value = value as string;

        if (this.node === null) {
            this.slot.render([
                this.node = document.createTextNode(this.value)
            ]);
        }
        else {
            this.node.textContent = this.value;
        }

        return this;
    }
}


export default (node: ChildNode, value: unknown) => {
    return new ReactiveNode( slot(node) ).update(value);
};
export { ReactiveNode };
