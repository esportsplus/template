import { effect } from '@esportsplus/reactivity';
import { isAsyncFunction } from '@esportsplus/utilities';
import { ANCHOR_MARKER } from '../constants';
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
    mode: number;
    scheduled = false;
    textnode: Node | null = null;


    constructor(anchor: Element, fn: ((...args: any[]) => any), mode: number = ANCHOR_MARKER) {
        this.anchor = anchor;
        this.disposer = null;
        this.mode = mode;

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
        let { anchor, disposer, group, mode, textnode } = this;

        if (!disposer) {
            return;
        }

        if (mode === ANCHOR_MARKER) {
            if (textnode) {
                group = { head: anchor, tail: textnode as Element };
            }
            else if (group) {
                group.head = anchor;
            }
        }
        else if (textnode) {
            group = { head: textnode as Element, tail: textnode as Element };
        }

        disposer();

        if (group) {
            remove(group);
        }
    }

    update(value: unknown): void {
        let { anchor, group, mode, textnode } = this;

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
                    if (mode === ANCHOR_MARKER) {
                        anchor.after(textnode);
                    }
                    else {
                        anchor.appendChild(textnode);
                    }
                }
            }
            else {
                textnode = this.textnode = text(value as string);

                if (mode === ANCHOR_MARKER) {
                    anchor.after(textnode);
                }
                else {
                    anchor.appendChild(textnode);
                }
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

                if (mode === ANCHOR_MARKER) {
                    anchor.after(fragment);
                }
                else {
                    anchor.appendChild(fragment);
                }
            }
        }
    }
}


export { EffectSlot };
