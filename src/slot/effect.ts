import { effect } from '@esportsplus/reactivity';
import { isAsyncFunction } from '@esportsplus/utilities';
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
    disposer: VoidFunction | null;
    group: SlotGroup | null = null;
    scheduled = false;
    textnode: Node | null = null;


    constructor(anchor: Element, fn: ((...args: any[]) => any)) {
        this.anchor = anchor;
        this.disposer = null;

        if (isAsyncFunction(fn)) {
            (fn as (fallback: (content: Renderable<any>) => void) => Promise<Renderable<any>>)(
                (content) => this.update(content)
            ).then((value) => this.update(value), () => {});
        }
        else {
            let dispose = fn.length ? () => this.dispose() : undefined,
                value: unknown;

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
    }


    dispose() {
        let { anchor, disposer, group, textnode } = this;

        if (!disposer) {
            return;
        }

        if (textnode) {
            group = { head: anchor, tail: textnode as Element };
        }
        else if (group) {
            group.head = anchor;
        }

        disposer();

        if (group) {
            remove(group);
        }
    }

    update(value: unknown): void {
        let { anchor, group, textnode } = this;

        value = read(value);

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
                head: Node | null,
                tail: Node | null;

            if (fragment.nodeType === 11) {
                head = fragment.firstChild;
                tail = fragment.lastChild;
            }
            else {
                head = fragment;
                tail = fragment;
            }

            if (textnode?.isConnected) {
                remove({ head: textnode as Element, tail: textnode as Element });
            }

            if (head) {
                this.group = {
                    head: head as Element,
                    tail: tail as Element
                };

                anchor.after(fragment);
            }
        }
    }
}


export { EffectSlot };
