import { effect } from '@esportsplus/reactivity';
import { STATE_HYDRATING, STATE_NONE } from '~/constants';
import { Element, Renderable, SlotGroup } from '~/types';
import { firstChild, lastChild, nodeValue } from '~/utilities/node'
import { raf } from '~/utilities/queue'
import { remove } from './cleanup';
import text from '~/utilities/text';
import render from './render';


class EffectSlot {
    anchor: Element;
    disposer: VoidFunction;
    group: SlotGroup | null = null;
    textnode: Node | null = null;


    constructor(anchor: Element, fn: (dispose?: VoidFunction) => Renderable<any>) {
        let dispose = fn.length ? () => this.dispose() : undefined,
            state = STATE_HYDRATING;

        this.anchor = anchor;
        this.disposer = effect(() => {
            let value = fn(dispose);

            if (state === STATE_HYDRATING) {
                state = STATE_NONE;
                this.update(value);
            }
            else {
                raf.add(() => {
                    this.update(value);
                });
            }
        });
    }


    dispose() {
        let { anchor, group, textnode } = this;

        if (textnode) {
            group = { head: anchor, tail: textnode as Element };
        }
        else if (group) {
            group.head = anchor;
        }

        this.disposer();

        if (group) {
            remove(group);
        }
    }

    update(value: unknown): void {
        if (typeof value === 'function') {
            return this.update( value() );
        }

        let { anchor, group, textnode } = this;

        if (group) {
            remove(group);
            this.group = null;
        }

        if (value == null || value === false) {
            value = '';
        }

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

            if (textnode?.isConnected) {
                remove({ head: textnode as Element, tail: textnode as Element });
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
}


export default (anchor: Element, fn: (dispose?: VoidFunction) => Renderable<any>) => {
    new EffectSlot(anchor, fn);
};