import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effect, flush, read, root, signal, write } from '@esportsplus/reactivity';
import { CLEANUP } from '../../src/constants';
import { adopt, claim, detach, enter, exit, ondisconnect, release, sweep, throws } from '../../src/slot/cleanup';
import type { Slot } from '../../src/slot/cleanup';
import { EffectSlot } from '../../src/slot/effect';
import { marker } from '../../src/utilities';
import type { Element, SlotGroup } from '../../src/types';


type Group = Slot & SlotGroup;


// A group owned the way an array row is: a root of its own, with the group as the slot being built
function owned(head: Node, tail: Node, build: () => void = () => {}): Group {
    let group = {
            anchor: head,
            disposed: false,
            head,
            parent: null,
            release: null,
            state: 0,
            tail
        } as unknown as Group;

    root((dispose) => {
        let parent = enter(group);

        group.release = dispose;

        try {
            build();
        }
        finally {
            exit(parent);
        }
    });

    return group;
}

function tick() {
    return new Promise<void>(resolve => queueMicrotask(resolve));
}


describe('slot/cleanup', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
        vi.restoreAllMocks();
    });

    describe('ondisconnect', () => {
        it('registers on the owner of the slot being built, not on the node', () => {
            let element = document.createElement('div') as unknown as Element,
                cleanup = vi.fn(),
                group = owned(element, element, () => ondisconnect(element, cleanup));

            expect(element[CLEANUP]).toBeUndefined();
            expect(cleanup).not.toHaveBeenCalled();

            group.release();

            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        it('registers on a reactivity owner the caller runs under, and runs once', async () => {
            let element = document.createElement('div') as unknown as Element,
                cleanup = vi.fn(),
                stop = root((dispose) => {
                    ondisconnect(element, cleanup);
                    return dispose;
                });

            stop();

            expect(cleanup).toHaveBeenCalledTimes(1);

            await tick();
            container.appendChild(element as unknown as Node);
            sweep();
            element.remove();
            sweep();

            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        it('keeps a cleanup made in a detached root inside a slot build, rather than losing it', () => {
            let element = document.createElement('div') as unknown as Element,
                cleanup = vi.fn(),
                group = owned(element, element, () => {
                    root(() => ondisconnect(element, cleanup));
                });

            group.release();

            expect(cleanup).not.toHaveBeenCalled();
            expect(element[CLEANUP]).toHaveLength(1);

            (element[CLEANUP] as VoidFunction[])[0]();

            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        it('keeps cleanups of content built outside any owner on the node, in order', () => {
            let element = document.createElement('div') as unknown as Element,
                calls: number[] = [];

            ondisconnect(element, () => calls.push(1));
            ondisconnect(element, () => calls.push(2));

            let fns = element[CLEANUP] as VoidFunction[];

            expect(fns).toHaveLength(2);

            fns[0]();
            fns[1]();

            expect(calls).toEqual([1, 2]);
        });
    });

    describe('release', () => {
        it('releases the owner in registration order and marks the slot disposed, once', () => {
            let element = document.createElement('div') as unknown as Element,
                calls: string[] = [],
                group = owned(element, element, () => {
                    ondisconnect(element, () => calls.push('1'));
                    ondisconnect(element, () => calls.push('2'));
                    ondisconnect(element, () => calls.push('3'));
                });

            expect(release(group, null)).toBeNull();
            expect(release(group, null)).toBeNull();
            expect(calls).toEqual(['1', '2', '3']);
            expect(group.disposed).toBe(true);
        });

        it('runs every cleanup when one throws and hands the error back', () => {
            let element = document.createElement('div') as unknown as Element,
                calls: string[] = [],
                group = owned(element, element, () => {
                    ondisconnect(element, () => calls.push('a'));
                    ondisconnect(element, () => { throw new Error('boom'); });
                    ondisconnect(element, () => calls.push('b'));
                }),
                errors = release(group, null);

            expect(calls).toEqual(['a', 'b']);
            expect(errors).toHaveLength(1);
            expect(() => throws(errors)).toThrow('boom');
            expect(group.disposed).toBe(true);
        });

        it('cascades into everything nested without walking the DOM', () => {
            let outer = document.createElement('div') as unknown as Element,
                inner = document.createElement('span') as unknown as Element,
                anchor = marker.cloneNode() as unknown as Element,
                cleanup = vi.fn(),
                runs = 0,
                s = signal(0);

            outer.appendChild(inner as unknown as Node);
            inner.appendChild(anchor as unknown as Node);
            container.appendChild(outer as unknown as Node);

            let group = owned(outer, outer, () => {
                    ondisconnect(inner, cleanup);
                    new EffectSlot(anchor, () => { runs++; return read(s); });
                    effect(() => { read(s); });
                });

            let walker = vi.spyOn(document, 'createTreeWalker');

            release(group, null);
            write(s, 1);
            flush();

            expect(cleanup).toHaveBeenCalledTimes(1);
            expect(runs).toBe(1);
            expect(walker).not.toHaveBeenCalled();
        });
    });

    describe('detach', () => {
        it('removes a single node', () => {
            let element = document.createElement('div') as unknown as Element;

            container.appendChild(element as unknown as Node);
            detach({ head: element, tail: element });

            expect(container.children.length).toBe(0);
        });

        it('removes a range, text and comment nodes included, and nothing past it', () => {
            let first = document.createElement('span') as unknown as Element,
                last = document.createElement('span') as unknown as Element,
                after = document.createElement('p');

            container.append(first as unknown as Node, document.createTextNode('text'), document.createComment('c'), last as unknown as Node, after);
            detach({ head: first, tail: last });

            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild).toBe(after);
        });
    });

    describe('content built outside any owner', () => {
        it('is adopted by the owner inserting it in the same task', () => {
            let content = document.createElement('div') as unknown as Element,
                inner = document.createElement('span') as unknown as Element,
                cleanup = vi.fn(),
                stray = document.createElement('p') as unknown as Element,
                strayCleanup = vi.fn();

            content.appendChild(inner as unknown as Node);
            ondisconnect(inner, cleanup);
            ondisconnect(stray, strayCleanup);

            let stop = root((dispose) => {
                    adopt(content as unknown as Node);
                    return dispose;
                });

            expect(inner[CLEANUP]).toBeUndefined();
            expect(stray[CLEANUP]).toHaveLength(1);

            stop();

            expect(cleanup).toHaveBeenCalledTimes(1);
            expect(strayCleanup).not.toHaveBeenCalled();
        });

        it('claims only the nodes inside the content', () => {
            let fragment = document.createDocumentFragment(),
                inside = document.createElement('div') as unknown as Element,
                outside = document.createElement('div') as unknown as Element;

            fragment.appendChild(inside as unknown as Node);
            ondisconnect(inside, () => {});
            ondisconnect(inside, () => {});
            ondisconnect(outside, () => {});

            expect(claim(fragment)).toHaveLength(2);
            expect(claim(fragment)).toBeNull();
            expect(outside[CLEANUP]).toHaveLength(1);
        });

        it('is released once mounted and then removed, if never adopted', async () => {
            let element = document.createElement('div') as unknown as Element,
                cleanup = vi.fn();

            ondisconnect(element, cleanup);
            await tick();

            sweep();

            expect(cleanup).not.toHaveBeenCalled();

            container.appendChild(element as unknown as Node);
            sweep();
            element.remove();
            sweep();

            expect(cleanup).toHaveBeenCalledTimes(1);
            expect(element[CLEANUP]).toBeUndefined();
        });

        it('is never released while never mounted', async () => {
            let element = document.createElement('div') as unknown as Element,
                cleanup = vi.fn();

            ondisconnect(element, cleanup);
            await tick();

            for (let i = 0; i < 100; i++) {
                sweep();
            }

            expect(cleanup).not.toHaveBeenCalled();
            expect(element[CLEANUP]).toHaveLength(1);
        });
    });
});
