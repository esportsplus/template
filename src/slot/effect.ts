import { effect } from '@esportsplus/reactivity';
import { isAsyncFunction } from '@esportsplus/utilities';
import { ANCHOR_MARKER } from '../constants';
import { Element, Renderable, SlotGroup } from '../types';
import { text } from '../utilities'
import { claim, context, detach, enter, exit, MOUNTED, ondisconnect, run, stale, track } from './cleanup';
import type { Slot } from './cleanup';
import render from './render';


function unwrap(value: unknown): unknown {
    if (typeof value === 'function') {
        return unwrap( value() );
    }

    if (value == null || value === false) {
        return '';
    }

    return value;
}


// Content built inside the effect belongs to the run that built it, as reactivity owns whatever a run creates, so the
// next run releases it. A run returning the object already shown leaves the DOM alone, so a node built outside the
// effect keeps its bindings. Content no owner built is adopted here and released when it is replaced.
class EffectSlot implements Slot {
    anchor: Element;
    content: VoidFunction[] | null = null;
    disposed = false;
    disposer: VoidFunction | null;
    group: SlotGroup | null = null;
    mode: number;
    parent: Slot | null;
    state = 0;
    textnode: Node | null = null;
    value: unknown = null;


    constructor(anchor: Element, fn: ((...args: any[]) => any), mode: number = ANCHOR_MARKER) {
        this.anchor = anchor;
        this.disposer = null;
        this.mode = mode;
        this.parent = context();

        // Owner disposal removes the DOM range wholesale; releasing is all that is left, so late promise work cannot
        // write into detached nodes or create orphan effects
        ondisconnect(anchor, () => this.release());

        if (isAsyncFunction(fn)) {
            (fn as (fallback: (content: Renderable<any>) => void) => Promise<Renderable<any>>)(
                (content) => {
                    if (!this.disposed) {
                        this.update(content);
                    }
                }
            ).then(
                (value) => {
                    if (!this.disposed) {
                        this.update(value);
                    }
                },
                () => {}
            );
        }
        else {
            let dispose = fn.length ? () => this.dispose() : undefined,
                // Reruns already wait for reactivity's microtask, so each one writes straight away.
                disposer = effect(() => {
                    if (this.anchor.isConnected) {
                        this.state |= MOUNTED;
                    }
                    // Out of the document after being seen in it: idle until the end of the task tells a move from a
                    // removal, then revived or released
                    else if (this.state & MOUNTED) {
                        stale(this);
                        return;
                    }

                    let parent = enter(this);

                    try {
                        let value = unwrap( fn(dispose) );

                        if (!this.disposed) {
                            this.update(value);
                        }
                    }
                    finally {
                        exit(parent);
                    }
                });

            // Disposed during its first run, before the disposer existed
            if (this.disposed) {
                disposer();
            }
            else {
                this.disposer = disposer;
            }
        }

        track(this);
    }


    // Removes the nodes even when the slot was already released, by its owner or a heal
    dispose() {
        let { anchor, group, mode, textnode } = this;

        try {
            this.release();
        }
        finally {
            if (group) {
                if (mode === ANCHOR_MARKER) {
                    group.head = anchor;
                }

                detach(group);
                this.group = null;
            }
            else if (textnode?.parentNode) {
                detach({
                    head: (mode === ANCHOR_MARKER ? anchor : textnode) as Element,
                    tail: textnode as Element
                });
                this.textnode = null;
            }
            else if (mode === ANCHOR_MARKER) {
                anchor.remove();
            }
        }
    }

    release() {
        if (this.disposed) {
            return;
        }

        let { content, disposer } = this;

        this.content = null;
        this.disposed = true;

        // Owner disposal has usually stopped the effect already; stopping it again is a no-op
        try {
            disposer?.();
        }
        finally {
            if (content) {
                run(content);
            }
        }
    }

    update(value: unknown): void {
        let { anchor, content, group, mode, textnode } = this;

        value = unwrap(value);

        if (group) {
            if (value === this.value) {
                return;
            }

            detach(group);
            this.content = this.group = this.value = null;
        }

        if (typeof value !== 'object') {
            if (typeof value !== 'string') {
                value = String(value);
            }

            if (textnode) {
                textnode.nodeValue = value as string;

                if (textnode.parentNode === null) {
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
            let fragment = render(value),
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

            if (textnode?.parentNode) {
                (textnode as ChildNode).remove();
                this.textnode = null;
            }

            if (head) {
                this.content = claim(fragment);
                this.group = {
                    head: head as Element,
                    tail: tail as Element
                };
                this.value = value;

                if (mode === ANCHOR_MARKER) {
                    anchor.after(fragment);
                }
                else {
                    anchor.appendChild(fragment);
                }
            }
        }

        // The replaced content's cleanups run once the new content is in place
        if (group && content) {
            run(content);
        }
    }
}


export { EffectSlot };
