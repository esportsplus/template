import { effect } from '@esportsplus/reactivity';
import { EMPTY_FRAGMENT, STATE_HYDRATING, STATE_NONE } from '~/constants';
import { Element, Fragment, SlotGroup } from '~/types';
import { cloneNode, firstChild, lastChild, nodeValue, raf, text } from '~/utilities'
import { ondisconnect } from '~/slot/cleanup';
import { remove } from './cleanup';
import render from './render';


function update(this: { group?: SlotGroup, textnode?: Element }, anchor: Element, fragment: Fragment, value: unknown) {
    let type = typeof value;

    if (this.group) {
        remove([this.group]);
        this.group = undefined;
    }

    if (value == null || type !== 'object') {
        let textnode = this.textnode;

        if (textnode) {
            // textnode.nodeValue = String(value);
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
        render(anchor, fragment, value);

        this.group = {
            // head: fragment.firstChild as Element,
            // tail: fragment.lastChild as Element
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
        // fragment = EMPTY_FRAGMENT.cloneNode() as Fragment,
        fragment = cloneNode.call(EMPTY_FRAGMENT) as Fragment,
        state = STATE_HYDRATING;

    ondisconnect(
        anchor,
        effect(() => {
            let value = fn();

            if (state === STATE_HYDRATING) {
                update.call(context, anchor, fragment, value);
                state = STATE_NONE;
            }
            else if (state === STATE_NONE) {
                raf.add(() => {
                    update.call(context, anchor, fragment, value);
                });
            }
        })
    );
};