import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ondisconnect, remove } from '../../src/slot/cleanup';
import { CLEANUP } from '../../src/constants';
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

            remove(group);

            expect(container.children.length).toBe(0);
        });

        it('calls cleanup function when removing element', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            container.appendChild(element);
            ondisconnect(element as unknown as Element, cleanup);

            let group: SlotGroup = { head: element as unknown as Element, tail: element as unknown as Element };

            remove(group);

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

            remove(group);

            expect(callOrder).toEqual([3, 2, 1]); // Popped in reverse
        });

        it('removes range of elements (head to tail)', () => {
            let first = document.createElement('span') as Element,
                middle = document.createElement('span') as Element,
                last = document.createElement('span') as Element;

            container.appendChild(first as unknown as Node);
            container.appendChild(middle as unknown as Node);
            container.appendChild(last as unknown as Node);

            let group: SlotGroup = { head: first, tail: last };

            remove(group);

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

            remove(group);

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

            remove(
                { head: group1Head, tail: group1Tail },
                { head: group2Head, tail: group2Tail }
            );

            expect(container.children.length).toBe(0);
        });

        it('handles group where head equals tail (single node)', () => {
            let single = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            container.appendChild(single);
            ondisconnect(single as unknown as Element, cleanup);

            let group: SlotGroup = { head: single as unknown as Element, tail: single as unknown as Element };

            remove(group);

            expect(container.children.length).toBe(0);
            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        it('handles group with no tail (uses head as tail)', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown };

            container.appendChild(element);

            let group = { head: element as unknown as Element } as SlotGroup;

            remove(group);

            expect(container.children.length).toBe(0);
        });

        it('handles elements without cleanup functions', () => {
            let element = document.createElement('div') as Element;

            container.appendChild(element as unknown as Node);

            let group: SlotGroup = { head: element, tail: element };

            expect(() => remove(group)).not.toThrow();
            expect(container.children.length).toBe(0);
        });

        it('clears cleanup array after calling functions', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                cleanup = vi.fn();

            container.appendChild(element);
            ondisconnect(element as unknown as Element, cleanup);

            let group: SlotGroup = { head: element as unknown as Element, tail: element as unknown as Element };

            remove(group);

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

            remove(group);

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

            remove(group);

            expect(container.childNodes.length).toBe(0);
        });
    });
});
