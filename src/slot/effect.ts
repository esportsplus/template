import { effect } from '@esportsplus/reactivity';
import { Element, Renderable, SlotGroup } from '../types';
import { raf, text } from '../utilities'
import { remove } from './cleanup';
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
            value: unknown;

        this.anchor = anchor;
        this.disposer = effect(() => {
            value = read( fn(dispose) );

            if (!this.disposer) {
                this.update(value);
            }
            else if (!this.scheduled) {
                this.scheduled = true;

                raf(() => {
                    this.scheduled = false;
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
                textnode.nodeValue = value as string;

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
                head = fragment.firstChild;

            if (textnode?.isConnected) {
                remove({ head: textnode as Element, tail: textnode as Element });
            }

            if (head) {
                this.group = {
                    head: head as Element,
                    tail: fragment.lastChild as Element
                };

                anchor.after(fragment);
            }
        }
    }
}


export { EffectSlot };
