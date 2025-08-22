import { effect } from '@esportsplus/reactivity';
import { STATE_HYDRATING, STATE_NONE } from '~/constants';
import { Element, SlotGroup } from '~/types';
import { firstChild, lastChild, nodeValue } from '~/utilities/node'
import { raf } from '~/utilities/queue'
import { remove } from './cleanup';
import text from '~/utilities/text';
import render from './render';


function update(this: { group?: SlotGroup, textnode?: Node }, anchor: Element, value: unknown) {
    if (this.group) {
        remove([this.group]);
        this.group = undefined;
    }

    if (value == null || value === false) {
        value = '';
    }

    let textnode = this.textnode;

    if (typeof value !== 'object') {
        if (textnode) {
            nodeValue.call(textnode, String(value));

            if (!textnode.isConnected) {
                anchor.after(textnode);
            }
        }
        else {
            anchor.after( this.textnode = text( String(value) ) );
        }
    }
    else {
        let fragment = render(anchor, value),
            head = firstChild.call(fragment);

        if (textnode && textnode.isConnected) {
            remove([{ head: textnode as Element, tail: textnode as Element }]);
        }

        if (head) {
            this.group = {
                head,
                tail: lastChild.call(fragment)
            };

            anchor.after(fragment);
        }
    }
}


export default (anchor: Element, fn: Function) => {
    let context = {
            group: undefined as SlotGroup | undefined,
            textnode: undefined as Node | undefined
        },
        state = STATE_HYDRATING;

    effect(() => {
        let value = fn();

        if (state === STATE_HYDRATING) {
            update.call(context, anchor, value);
            state = STATE_NONE;
        }
        else if (state === STATE_NONE) {
            raf.add(() => {
                update.call(context, anchor, value);
            });
        }
    });
};