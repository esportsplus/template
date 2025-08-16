import { effect } from '@esportsplus/reactivity';
import { STATE_HYDRATING, STATE_NONE } from '~/constants';
import { Element, SlotGroup } from '~/types';
import { firstChild, lastChild, nodeValue } from '~/utilities/node'
import { raf } from '~/utilities/queue'
import { ondisconnect } from '~/slot/cleanup';
import { remove } from './cleanup';
import text from '~/utilities/text';
import render from './render';


function update(this: { group?: SlotGroup, textnode?: Element }, anchor: Element, value: unknown) {
    let type = typeof value;

    if (this.group) {
        remove([this.group]);
        this.group = undefined;
    }

    if (value == null || type !== 'object') {
        let textnode = this.textnode;

        if (textnode) {
            nodeValue.call(textnode, String(value));
        }
        else {
            textnode = this.textnode = text( String(value) );
        }

        if (!textnode.isConnected) {
            anchor.after(textnode);
        }
    }
    else {
        let fragment = render(anchor, value);

        if (!fragment) {
            return;
        }

        this.group = {
            head: firstChild.call(fragment),
            tail: lastChild.call(fragment)
        };

        anchor.after(fragment);
    }
}


export default (anchor: Element, fn: Function) => {
    let context = {
            group: undefined as SlotGroup | undefined,
            textnode: undefined as Element | undefined
        },
        state = STATE_HYDRATING;

    ondisconnect(
        anchor,
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
        })
    );
};