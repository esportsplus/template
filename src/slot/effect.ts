import { effect } from '@esportsplus/reactivity';
import { Element, Renderable, SlotGroup } from '~/types';
import { firstChild, lastChild, nodeValue } from '~/utilities/node'
import { remove } from './cleanup';
import raf from '~/utilities/raf'
import text from '~/utilities/text';
import render from './render';


function read(value: unknown): unknown {
    if (typeof value === 'function') {
        return read( value() );
    }

    if (value == null || value === false) {
        return '';
    }

    return value;
}


class EffectSlot {
    anchor: Element;
    disposer: VoidFunction;
    group: SlotGroup | null = null;
    scheduled = false;
    textnode: Node | null = null;


    constructor(anchor: Element, fn: (dispose?: VoidFunction) => Renderable<any>) {
        let dispose = fn.length ? () => this.dispose() : undefined,
            slot = this;

        this.anchor = anchor;
        this.disposer = effect(function () {
            let value = read( fn(dispose) );

            if (!slot.disposer) {
                slot.update(value);
            }
            else if (!slot.scheduled) {
                slot.scheduled = true;

                raf(() => {
                    slot.scheduled = false;
                    slot.update(this.value);
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
        let { anchor, group, textnode } = this;

        if (group) {
            remove(group);
            this.group = null;
        }

        if (typeof value !== 'object') {
            if (typeof value !== 'string') {
                value = String(value);
            }

            if (textnode) {
                nodeValue.call(textnode, value);

                if (!textnode.isConnected) {
                    anchor.after(textnode);
                }
            }
            else {
                anchor.after( this.textnode = text(value as string) );
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


export { EffectSlot };