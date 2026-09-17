import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLEANUP } from '../../src/constants';
import { dispose, ondisconnect, remove } from '../../src/slot/cleanup';
import type { Element, SlotGroup } from '../../src/types';


describe('slot/cleanup', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    describe('ondisconnect', () => {
        it('registers cleanup function on element', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            ondisconnect(element as unknown as Element, cleanup);

            expect(element[CLEANUP]).toBeInstanceOf(Array);
            expect((element[CLEANUP] as VoidFunction[]).length).toBe(1);
            expect((element[CLEANUP] as VoidFunction[])[0]).toBe(cleanup);
        });

        it('registers multiple cleanup functions', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup1 = vi.fn(),
                cleanup2 = vi.fn(),
                cleanup3 = vi.fn();

            ondisconnect(element as unknown as Element, cleanup1);
            ondisconnect(element as unknown as Element, cleanup2);
            ondisconnect(element as unknown as Element, cleanup3);

            expect((element[CLEANUP] as VoidFunction[]).length).toBe(3);
        });

        it('preserves existing cleanup functions when adding new ones', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup1 = vi.fn(),
                cleanup2 = vi.fn();

            ondisconnect(element as unknown as Element, cleanup1);
            ondisconnect(element as unknown as Element, cleanup2);

            expect((element[CLEANUP] as VoidFunction[])[0]).toBe(cleanup1);
            expect((element[CLEANUP] as VoidFunction[])[1]).toBe(cleanup2);
        });
    });

    describe('remove', () => {
        it('removes single element from DOM', () => {
            let element = document.createElement('div') as Element;

            container.appendChild(element as unknown as Node);

            let group: SlotGroup = { head: element, tail: element };

            remove([group]);

            expect(container.children.length).toBe(0);
        });

        it('calls cleanup function when removing element', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            container.appendChild(element);
            ondisconnect(element as unknown as Element, cleanup);

            let group: SlotGroup = { head: element as unknown as Element, tail: element as unknown as Element };

            remove([group]);

            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        it('calls multiple cleanup functions in reverse order', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                callOrder: number[] = [],
                cleanup1 = vi.fn(() => callOrder.push(1)),
                cleanup2 = vi.fn(() => callOrder.push(2)),
                cleanup3 = vi.fn(() => callOrder.push(3));

            container.appendChild(element);
            ondisconnect(element as unknown as Element, cleanup1);
            ondisconnect(element as unknown as Element, cleanup2);
            ondisconnect(element as unknown as Element, cleanup3);

            let group: SlotGroup = { head: element as unknown as Element, tail: element as unknown as Element };

            remove([group]);

            expect(callOrder).toEqual([3, 2, 1]);
        });

        it('removes range of elements (head to tail)', () => {
            let first = document.createElement('span') as Element,
                middle = document.createElement('span') as Element,
                last = document.createElement('span') as Element;

            container.appendChild(first as unknown as Node);
            container.appendChild(middle as unknown as Node);
            container.appendChild(last as unknown as Node);

            let group: SlotGroup = { head: first, tail: last };

            remove([group]);

            expect(container.children.length).toBe(0);
        });

        it('calls cleanup on all elements in range', () => {
            let first = document.createElement('span') as HTMLElement & { [key: symbol]: unknown },
                middle = document.createElement('span') as HTMLElement & { [key: symbol]: unknown },
                last = document.createElement('span') as HTMLElement & { [key: symbol]: unknown },
                cleanup1 = vi.fn(),
                cleanup2 = vi.fn(),
                cleanup3 = vi.fn();

            container.appendChild(first);
            container.appendChild(middle);
            container.appendChild(last);

            ondisconnect(first as unknown as Element, cleanup1);
            ondisconnect(middle as unknown as Element, cleanup2);
            ondisconnect(last as unknown as Element, cleanup3);

            let group: SlotGroup = { head: first as unknown as Element, tail: last as unknown as Element };

            remove([group]);

            expect(cleanup1).toHaveBeenCalledTimes(1);
            expect(cleanup2).toHaveBeenCalledTimes(1);
            expect(cleanup3).toHaveBeenCalledTimes(1);
        });

        it('removes multiple groups', () => {
            let group1Head = document.createElement('div') as Element,
                group1Tail = document.createElement('div') as Element,
                group2Head = document.createElement('div') as Element,
                group2Tail = document.createElement('div') as Element;

            container.appendChild(group1Head as unknown as Node);
            container.appendChild(group1Tail as unknown as Node);
            container.appendChild(group2Head as unknown as Node);
            container.appendChild(group2Tail as unknown as Node);

            remove([
                { head: group1Head, tail: group1Tail },
                { head: group2Head, tail: group2Tail }
            ]);

            expect(container.children.length).toBe(0);
        });

        it('handles group where head equals tail (single node)', () => {
            let single = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            container.appendChild(single);
            ondisconnect(single as unknown as Element, cleanup);

            let group: SlotGroup = { head: single as unknown as Element, tail: single as unknown as Element };

            remove([group]);

            expect(container.children.length).toBe(0);
            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        it('handles group with no tail (uses head as tail)', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown };

            container.appendChild(element);

            let group = { head: element as unknown as Element } as SlotGroup;

            remove([group]);

            expect(container.children.length).toBe(0);
        });

        it('handles elements without cleanup functions', () => {
            let element = document.createElement('div') as Element;

            container.appendChild(element as unknown as Node);

            let group: SlotGroup = { head: element, tail: element };

            expect(() => remove([group])).not.toThrow();
            expect(container.children.length).toBe(0);
        });

        it('clears cleanup array after calling functions', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            container.appendChild(element);
            ondisconnect(element as unknown as Element, cleanup);

            let group: SlotGroup = { head: element as unknown as Element, tail: element as unknown as Element };

            remove([group]);

            expect((element[CLEANUP] as VoidFunction[]).length).toBe(0);
        });

        it('handles text nodes in range', () => {
            let first = document.createElement('span') as Element,
                textNode = document.createTextNode('text') as unknown as Element,
                last = document.createElement('span') as Element;

            container.appendChild(first as unknown as Node);
            container.appendChild(textNode as unknown as Node);
            container.appendChild(last as unknown as Node);

            let group: SlotGroup = { head: first, tail: last };

            remove([group]);

            expect(container.childNodes.length).toBe(0);
        });

        it('handles comment nodes in range', () => {
            let first = document.createElement('span') as Element,
                comment = document.createComment('comment') as unknown as Element,
                last = document.createElement('span') as Element;

            container.appendChild(first as unknown as Node);
            container.appendChild(comment as unknown as Node);
            container.appendChild(last as unknown as Node);

            let group: SlotGroup = { head: first, tail: last };

            remove([group]);

            expect(container.childNodes.length).toBe(0);
        });
    });

    describe('dispose', () => {
        it('runs cleanup functions without removing nodes', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            container.appendChild(element);
            ondisconnect(element as unknown as Element, cleanup);

            let group: SlotGroup = { head: element as unknown as Element, tail: element as unknown as Element };

            dispose([group]);

            expect(cleanup).toHaveBeenCalledTimes(1);
            expect(container.children.length).toBe(1);
        });

        it('runs cleanup tail to head across a range and removes no nodes', () => {
            let first = document.createElement('span') as HTMLElement & { [key: symbol]: unknown },
                middle = document.createElement('span') as HTMLElement & { [key: symbol]: unknown },
                last = document.createElement('span') as HTMLElement & { [key: symbol]: unknown },
                callOrder: number[] = [];

            container.appendChild(first);
            container.appendChild(middle);
            container.appendChild(last);

            ondisconnect(first as unknown as Element, () => callOrder.push(1));
            ondisconnect(middle as unknown as Element, () => callOrder.push(2));
            ondisconnect(last as unknown as Element, () => callOrder.push(3));

            let group: SlotGroup = { head: first as unknown as Element, tail: last as unknown as Element };

            dispose([group]);

            expect(callOrder).toEqual([3, 2, 1]);
            expect(container.childNodes.length).toBe(3);
        });

        it('empties the cleanup array after running its functions', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            container.appendChild(element);
            ondisconnect(element as unknown as Element, cleanup);

            let group: SlotGroup = { head: element as unknown as Element, tail: element as unknown as Element };

            dispose([group]);

            expect((element[CLEANUP] as VoidFunction[]).length).toBe(0);
        });

        it('runs cleanup for multiple groups and removes no nodes', () => {
            let group1 = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                group2 = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup1 = vi.fn(),
                cleanup2 = vi.fn();

            container.appendChild(group1);
            container.appendChild(group2);
            ondisconnect(group1 as unknown as Element, cleanup1);
            ondisconnect(group2 as unknown as Element, cleanup2);

            dispose([
                { head: group1 as unknown as Element, tail: group1 as unknown as Element },
                { head: group2 as unknown as Element, tail: group2 as unknown as Element }
            ]);

            expect(cleanup1).toHaveBeenCalledTimes(1);
            expect(cleanup2).toHaveBeenCalledTimes(1);
            expect(container.children.length).toBe(2);
        });

        it('handles elements without cleanup functions', () => {
            let element = document.createElement('div') as Element;

            container.appendChild(element as unknown as Node);

            let group: SlotGroup = { head: element, tail: element };

            expect(() => dispose([group])).not.toThrow();
            expect(container.children.length).toBe(1);
        });
    });

    describe('nested cleanup (B11)', () => {
        it('fires cleanup registered on a descendant element', () => {
            let outer = document.createElement('div') as Element,
                inner = document.createElement('span') as Element,
                cleanup = vi.fn();

            outer.appendChild(inner as unknown as Node);
            container.appendChild(outer as unknown as Node);
            ondisconnect(inner, cleanup);

            remove([{ head: outer, tail: outer }]);

            expect(cleanup).toHaveBeenCalledTimes(1);
            expect(container.children.length).toBe(0);
        });

        it('fires descendant cleanup before the parent cleanup', () => {
            let outer = document.createElement('div') as Element,
                inner = document.createElement('span') as Element,
                callOrder: string[] = [];

            outer.appendChild(inner as unknown as Node);
            container.appendChild(outer as unknown as Node);
            ondisconnect(outer, () => callOrder.push('outer'));
            ondisconnect(inner, () => callOrder.push('inner'));

            remove([{ head: outer, tail: outer }]);

            expect(callOrder).toEqual(['inner', 'outer']);
        });

        it('skips the descendant query for elements without children', () => {
            let element = document.createElement('div') as Element,
                spy = vi.spyOn(element as unknown as HTMLElement, 'querySelectorAll');

            container.appendChild(element as unknown as Node);
            ondisconnect(element, vi.fn());

            remove([{ head: element, tail: element }]);

            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('node-capable subtree cleanup', () => {
        it('fires cleanup registered on a descendant comment node', () => {
            let outer = document.createElement('div') as Element,
                comment = document.createComment('anchor') as unknown as Element,
                cleanup = vi.fn();

            outer.appendChild(comment as unknown as Node);
            container.appendChild(outer as unknown as Node);
            ondisconnect(comment, cleanup);

            remove([{ head: outer, tail: outer }]);

            expect(cleanup).toHaveBeenCalledTimes(1);
            expect(container.children.length).toBe(0);
        });

        it('fires cleanup registered on a descendant text node', () => {
            let outer = document.createElement('div') as Element,
                textnode = document.createTextNode('text') as unknown as Element,
                cleanup = vi.fn();

            outer.appendChild(textnode as unknown as Node);
            container.appendChild(outer as unknown as Node);
            ondisconnect(textnode, cleanup);

            remove([{ head: outer, tail: outer }]);

            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        it('reaches cleanup registered before the host is inserted', () => {
            let host = document.createElement('div') as Element,
                inner = document.createElement('span') as Element,
                cleanup = vi.fn();

            host.appendChild(inner as unknown as Node);
            ondisconnect(inner, cleanup);

            container.appendChild(host as unknown as Node);
            remove([{ head: host, tail: host }]);

            expect(cleanup).toHaveBeenCalledTimes(1);
            expect(container.children.length).toBe(0);
        });

        it('drains every callback even when one throws', () => {
            let element = document.createElement('div') as Element,
                calls: string[] = [];

            container.appendChild(element as unknown as Node);
            ondisconnect(element, () => calls.push('a'));
            ondisconnect(element, () => { throw new Error('boom'); });
            ondisconnect(element, () => calls.push('b'));

            expect(() => remove([{ head: element, tail: element }])).toThrow('boom');
            expect(calls).toEqual(['b', 'a']);
            expect(container.children.length).toBe(0);
        });

        it('repeated removal is a no-op', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            container.appendChild(element);
            ondisconnect(element as unknown as Element, cleanup);

            let group: SlotGroup = { head: element as unknown as Element, tail: element as unknown as Element };

            remove([group]);
            expect(cleanup).toHaveBeenCalledTimes(1);

            expect(() => remove([group])).not.toThrow();
            expect(cleanup).toHaveBeenCalledTimes(1);
        });
    });

    describe('disposal hardening', () => {
        it('reaches cleanup registered on a descendant comment anchor', () => {
            let element = document.createElement('div') as Element,
                comment = document.createComment('anchor') as unknown as Element,
                cleanup = vi.fn();

            element.appendChild(comment as unknown as Node);
            container.appendChild(element as unknown as Node);

            ondisconnect(comment, cleanup);

            remove([{ head: element, tail: element }]);

            expect(cleanup).toHaveBeenCalledTimes(1);
            expect(container.childNodes.length).toBe(0);
        });

        it('fires cleanup registered before insertion once the fragment is removed', () => {
            let fragment = document.createDocumentFragment(),
                element = document.createElement('div') as Element,
                cleanup = vi.fn();

            fragment.appendChild(element as unknown as Node);
            ondisconnect(element, cleanup);

            container.appendChild(fragment);

            remove([{ head: element, tail: element }]);

            expect(cleanup).toHaveBeenCalledTimes(1);
            expect(container.childNodes.length).toBe(0);
        });

        it('drains every cleanup even when one throws', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                calls: string[] = [];

            container.appendChild(element);
            ondisconnect(element as unknown as Element, () => {
                calls.push('first');
                throw new Error('boom');
            });
            ondisconnect(element as unknown as Element, () => calls.push('second'));

            expect(() => dispose([{ head: element as unknown as Element, tail: element as unknown as Element }]))
                .toThrow('boom');

            expect(calls).toEqual(['second', 'first']);
        });

        it('repeated disposal is a no-op', () => {
            let element = document.createElement('div') as Element,
                cleanup = vi.fn();

            container.appendChild(element as unknown as Node);
            ondisconnect(element, cleanup);

            dispose([{ head: element, tail: element }]);
            dispose([{ head: element, tail: element }]);

            expect(cleanup).toHaveBeenCalledTimes(1);
        });
    });

});
