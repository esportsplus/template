import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ArraySlot } from '../../src/slot/array';
import { ondisconnect } from '../../src/slot/cleanup';
import { ARRAY_SLOT } from '../../src/constants';
import { Element } from '../../src/types';
import { reactive } from '@esportsplus/reactivity';


describe('slot/ArraySlot', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    describe('construction', () => {
        it('creates ArraySlot from reactive array', () => {
            let arr = reactive([1, 2, 3] as number[]),
                slot = new ArraySlot(arr, (n) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = String(n);
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            expect(slot).toBeInstanceOf(ArraySlot);
        });

        it('has fragment property', () => {
            let arr = reactive([] as number[]),
                slot = new ArraySlot(arr, () => document.createDocumentFragment() as unknown as DocumentFragment);

            expect(slot.fragment).toBeInstanceOf(DocumentFragment);
        });

        it('is marked with ARRAY_SLOT symbol', () => {
            let arr = reactive([] as number[]),
                slot = new ArraySlot(arr, () => document.createDocumentFragment() as unknown as DocumentFragment);

            expect((slot as unknown as Record<symbol, boolean>)[ARRAY_SLOT]).toBe(true);
        });

        it('renders initial array items', () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(3);
            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('c');
        });

        it('handles empty initial array', () => {
            let arr = reactive([] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment();

                    frag.appendChild(document.createTextNode(s));

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            // Should only have the marker comment
            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
        });
    });

    describe('length property', () => {
        it('returns initial array length', () => {
            let arr = reactive([1, 2, 3] as number[]),
                slot = new ArraySlot(arr, (n) => {
                    let frag = document.createDocumentFragment();

                    frag.appendChild(document.createTextNode(String(n)));

                    return frag as unknown as DocumentFragment;
                });

            expect(slot.length).toBe(3);
        });

        it('returns 0 for empty array', () => {
            let arr = reactive([] as number[]),
                slot = new ArraySlot(arr, (n) => {
                    let frag = document.createDocumentFragment();

                    frag.appendChild(document.createTextNode(String(n)));

                    return frag as unknown as DocumentFragment;
                });

            expect(slot.length).toBe(0);
        });
    });

    describe('push operation', () => {
        it('adds items to end', async () => {
            let arr = reactive(['a'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.push('b', 'c');

            // Wait for RAF
            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(3);
            expect(spans[2].textContent).toBe('c');
        });
    });

    describe('pop operation', () => {
        it('removes last item', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.pop();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(2);
            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
        });
    });

    describe('shift operation', () => {
        it('removes first item', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.shift();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(2);
            expect(spans[0].textContent).toBe('b');
            expect(spans[1].textContent).toBe('c');
        });
    });

    describe('unshift operation', () => {
        it('adds items to beginning', async () => {
            let arr = reactive(['c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.unshift('a', 'b');

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(3);
            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('c');
        });
    });

    describe('splice operation', () => {
        it('removes items from middle', async () => {
            let arr = reactive(['a', 'b', 'c', 'd'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.splice(1, 2);

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(2);
            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('d');
        });

        it('inserts items at position', async () => {
            let arr = reactive(['a', 'd'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.splice(1, 0, 'b', 'c');

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(4);
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('c');
        });

        it('replaces items', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.splice(1, 1, 'x', 'y');

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(4);
            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('x');
            expect(spans[2].textContent).toBe('y');
            expect(spans[3].textContent).toBe('c');
        });
    });

    describe('reverse operation', () => {
        it('reverses item order', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.reverse();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans[0].textContent).toBe('c');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('a');
        });
    });

    describe('sort operation', () => {
        it('sorts items', async () => {
            let arr = reactive(['c', 'a', 'b'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.sort();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('c');
        });
    });

    describe('clear operation', () => {
        it('removes all items via splice', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);
            arr.splice(0, arr.length);

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(0);
        });
    });

    describe('concat operation', () => {
        it('adds concatenated items', async () => {
            let arr = reactive(['a'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            // The concat method on reactive arrays triggers the 'concat' event
            let newArr = arr.concat(['b', 'c']);

            await new Promise(resolve => requestAnimationFrame(resolve));

            // Note: concat returns a new array, but the event should still fire
            // The original array listeners should handle it
        });
    });

    describe('template callback', () => {
        it('receives reactive item value', () => {
            let values: string[] = [],
                arr = reactive(['a', 'b', 'c'] as string[]);

            new ArraySlot(arr, (s) => {
                values.push(s);

                let frag = document.createDocumentFragment();

                frag.appendChild(document.createTextNode(s));

                return frag as unknown as DocumentFragment;
            });

            expect(values).toEqual(['a', 'b', 'c']);
        });
    });

    describe('multi-node templates', () => {
        it('handles templates with multiple root nodes', async () => {
            let arr = reactive([1, 2] as number[]),
                slot = new ArraySlot(arr, (n) => {
                    let frag = document.createDocumentFragment(),
                        span1 = document.createElement('span'),
                        span2 = document.createElement('span');

                    span1.textContent = `${n}a`;
                    span2.textContent = `${n}b`;
                    frag.appendChild(span1);
                    frag.appendChild(span2);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(4);
            expect(spans[0].textContent).toBe('1a');
            expect(spans[1].textContent).toBe('1b');
            expect(spans[2].textContent).toBe('2a');
            expect(spans[3].textContent).toBe('2b');
        });
    });

    describe('batched updates', () => {
        it('batches multiple operations', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            // Multiple operations in same frame
            arr.push('d');
            arr.push('e');
            arr.shift();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(4);
            expect(spans[0].textContent).toBe('b');
            expect(spans[3].textContent).toBe('e');
        });
    });

    describe('rapid successive operations', () => {
        it('batches push+push+pop in same frame', async () => {
            let arr = reactive(['a'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            arr.push('b');
            arr.push('c');
            arr.pop();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(2);
            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
        });

        it('batches unshift+pop+push in same frame', async () => {
            let arr = reactive(['b'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            arr.unshift('a');
            arr.pop();
            arr.push('c');

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(2);
            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('c');
        });
    });

    describe('empty array edge cases', () => {
        it('pop on empty array does not throw', async () => {
            let arr = reactive([] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            arr.pop();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(0);
        });

        it('shift on empty array does not throw', async () => {
            let arr = reactive([] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            arr.shift();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(0);
        });

        it('splice beyond bounds does not throw', async () => {
            let arr = reactive(['a'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            arr.splice(10, 5);

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(1);
            expect(spans[0].textContent).toBe('a');
        });
    });

    describe('large array operations', () => {
        it('pushes 50+ items and renders all correctly', async () => {
            let arr = reactive([] as number[]),
                slot = new ArraySlot(arr, (n) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = String(n);
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            let items: number[] = [];

            for (let i = 0; i < 60; i++) {
                items.push(i);
            }

            arr.push(...items);

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(60);
            expect(spans[0].textContent).toBe('0');
            expect(spans[59].textContent).toBe('59');
        });
    });

    describe('set operation', () => {
        it('replaces a single item by index via splice', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            arr.splice(1, 1, 'x');

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(3);
            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('x');
            expect(spans[2].textContent).toBe('c');
        });

        it('replaces first item by index via splice', async () => {
            let arr = reactive(['a', 'b'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            arr.splice(0, 1, 'z');

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(2);
            expect(spans[0].textContent).toBe('z');
            expect(spans[1].textContent).toBe('b');
        });
    });

    describe('moveBefore API', () => {
        it('sort uses moveBefore when available on parent', async () => {
            let arr = reactive(['c', 'a', 'b'] as string[]),
                moveBeforeCalls: [Node, Node | null][] = [],
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            // Polyfill moveBefore on the parent
            (container as any).moveBefore = function (node: Node, ref: Node | null) {
                moveBeforeCalls.push([node, ref]);
                container.insertBefore(node, ref);
            };

            arr.sort();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('c');
            expect(moveBeforeCalls.length).toBeGreaterThan(0);

            delete (container as any).moveBefore;
        });

        it('sort falls back to insertBefore without moveBefore', async () => {
            let arr = reactive(['c', 'a', 'b'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            // Ensure no moveBefore
            expect('moveBefore' in container).toBe(false);

            arr.sort();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('c');
        });

        it('reverse uses moveBefore when available via sync', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                moveBeforeCalls: [Node, Node | null][] = [],
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            (container as any).moveBefore = function (node: Node, ref: Node | null) {
                moveBeforeCalls.push([node, ref]);
                container.insertBefore(node, ref);
            };

            arr.reverse();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans[0].textContent).toBe('c');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('a');
            expect(moveBeforeCalls.length).toBeGreaterThan(0);

            delete (container as any).moveBefore;
        });

        it('reverse falls back to fragment approach without moveBefore', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            expect('moveBefore' in container).toBe(false);

            arr.reverse();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans[0].textContent).toBe('c');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('a');
        });

        it('moveBefore receives correct arguments during sort', async () => {
            let arr = reactive(['b', 'a'] as string[]),
                moveBeforeCalls: [string, string | null][] = [],
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    span.setAttribute('data-id', s);
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            (container as any).moveBefore = function (node: Node, ref: Node | null) {
                let nodeId = (node as HTMLElement).getAttribute?.('data-id') || '?',
                    refId = ref ? ((ref as HTMLElement).getAttribute?.('data-id') || '?') : null;

                moveBeforeCalls.push([nodeId, refId]);
                container.insertBefore(node, ref);
            };

            arr.sort();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');

            // 'a' should be moved before 'b'
            expect(moveBeforeCalls.some(([n]) => n === 'a')).toBe(true);

            delete (container as any).moveBefore;
        });

        it('sort with moveBefore preserves node order for already-sorted LIS', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                moveBeforeCalls: [Node, Node | null][] = [],
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            (container as any).moveBefore = function (node: Node, ref: Node | null) {
                moveBeforeCalls.push([node, ref]);
                container.insertBefore(node, ref);
            };

            arr.sort();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('c');

            // Already sorted — LIS covers all nodes, no moves needed
            expect(moveBeforeCalls.length).toBe(0);

            delete (container as any).moveBefore;
        });
    });

    describe('disconnect cleanup', () => {
        it('cleans up nodes when cleared', async () => {
            let cleanupCount = 0,
                arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(3);

            // Clear removes all items and their DOM nodes
            arr.splice(0, arr.length);

            await new Promise(resolve => requestAnimationFrame(resolve));

            spans = container.querySelectorAll('span');

            expect(spans.length).toBe(0);
        });

        it('removes nodes from DOM on pop', async () => {
            let arr = reactive(['a', 'b'] as string[]),
                slot = new ArraySlot(arr, (s) => {
                    let frag = document.createDocumentFragment(),
                        span = document.createElement('span');

                    span.textContent = s;
                    span.setAttribute('data-value', s);
                    frag.appendChild(span);

                    return frag as unknown as DocumentFragment;
                });

            container.appendChild(slot.fragment);

            let removed = container.querySelector('span[data-value="b"]');

            expect(removed).not.toBeNull();

            arr.pop();

            await new Promise(resolve => requestAnimationFrame(resolve));

            removed = container.querySelector('span[data-value="b"]');

            expect(removed).toBeNull();
            expect(container.querySelectorAll('span').length).toBe(1);
        });
    });

    describe('moveBefore connectivity guards', () => {
        let template = (s: string) => {
            let frag = document.createDocumentFragment(),
                span = document.createElement('span');

            span.textContent = s;
            frag.appendChild(span);

            return frag as unknown as DocumentFragment;
        };

        // Chrome 133+/Firefox 144+ throw when the target parent is disconnected.
        let throwingMoveBefore = (parent: HTMLElement) => {
            return function (node: Node, ref: Node | null) {
                if (!parent.isConnected) {
                    throw new Error('NotSupportedError: moveBefore target is disconnected');
                }

                parent.insertBefore(node, ref);
            };
        };

        it('sort on a detached parent falls back to insertBefore without throwing', async () => {
            let detached = document.createElement('div'),
                arr = reactive(['c', 'a', 'b'] as string[]),
                slot = new ArraySlot(arr, template);

            detached.appendChild(slot.fragment);
            (detached as any).moveBefore = throwingMoveBefore(detached);

            expect(detached.isConnected).toBe(false);

            arr.sort();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = detached.querySelectorAll('span');

            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('c');
        });

        it('reverse on a detached parent falls back to the fragment path without throwing', async () => {
            let detached = document.createElement('div'),
                arr = reactive(['a', 'b', 'c'] as string[]),
                slot = new ArraySlot(arr, template);

            detached.appendChild(slot.fragment);
            (detached as any).moveBefore = throwingMoveBefore(detached);

            expect(detached.isConnected).toBe(false);

            arr.reverse();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = detached.querySelectorAll('span');

            expect(spans[0].textContent).toBe('c');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('a');
        });

        it('sort on a connected parent still routes through moveBefore', async () => {
            let calls = 0,
                arr = reactive(['c', 'a', 'b'] as string[]),
                slot = new ArraySlot(arr, template);

            container.appendChild(slot.fragment);
            (container as any).moveBefore = function (node: Node, ref: Node | null) {
                if (!container.isConnected) {
                    throw new Error('NotSupportedError: moveBefore target is disconnected');
                }

                calls++;
                container.insertBefore(node, ref);
            };

            expect(container.isConnected).toBe(true);

            arr.sort();

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans[0].textContent).toBe('a');
            expect(spans[1].textContent).toBe('b');
            expect(spans[2].textContent).toBe('c');
            expect(calls).toBeGreaterThan(0);

            delete (container as any).moveBefore;
        });

        it('mount-time inserts never route through moveBefore', async () => {
            let calls = 0,
                arr = reactive(['b'] as string[]),
                slot = new ArraySlot(arr, template);

            container.appendChild(slot.fragment);
            (container as any).moveBefore = function (node: Node, ref: Node | null) {
                calls++;
                container.insertBefore(node, ref);
            };

            arr.push('c');
            arr.unshift('a');
            arr.splice(1, 0, 'x');

            await new Promise(resolve => requestAnimationFrame(resolve));

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(4);
            expect(calls).toBe(0);

            delete (container as any).moveBefore;
        });
    });

    describe('sole-child fast clear', () => {
        function tmpl(s: string) {
            let frag = document.createDocumentFragment(),
                span = document.createElement('span');

            span.textContent = s;
            frag.appendChild(span);

            return frag as unknown as DocumentFragment;
        }

        it('fires every row cleanup before the parent wipe, leaves only the marker, and re-anchors a following push', async () => {
            let arr = reactive(['a', 'b', 'c'] as string[]),
                cleanups = 0,
                spansAtCleanup: number[] = [],
                slot = new ArraySlot(arr, tmpl, true);

            container.appendChild(slot.fragment);

            let spans = container.querySelectorAll('span');

            expect(spans.length).toBe(3);

            for (let i = 0, n = spans.length; i < n; i++) {
                ondisconnect(spans[i] as unknown as Element, () => {
                    cleanups++;
                    spansAtCleanup.push(container.querySelectorAll('span').length);
                });
            }

            arr.clear();

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(cleanups).toBe(3);
            // Every cleanup ran while the rows were still connected (before the wipe)
            expect(spansAtCleanup.every(count => count === 3)).toBe(true);
            expect(container.querySelectorAll('span').length).toBe(0);
            // Only the internal marker remains
            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild?.nodeType).toBe(Node.COMMENT_NODE);

            arr.push('x');

            await new Promise(resolve => requestAnimationFrame(resolve));

            let after = container.querySelectorAll('span');

            expect(after.length).toBe(1);
            expect(after[0].textContent).toBe('x');
        });

        it('is behaviourally identical to the unflagged clear (marker retained, rows gone, cleanups fired)', async () => {
            let flagged = reactive(['a', 'b'] as string[]),
                flaggedCleanups = 0,
                flaggedSlot = new ArraySlot(flagged, tmpl, true),
                unflagged = reactive(['a', 'b'] as string[]),
                unflaggedCleanups = 0,
                unflaggedSlot = new ArraySlot(unflagged, tmpl, false),
                flaggedHost = document.createElement('div'),
                unflaggedHost = document.createElement('div');

            container.appendChild(flaggedHost);
            container.appendChild(unflaggedHost);
            flaggedHost.appendChild(flaggedSlot.fragment);
            unflaggedHost.appendChild(unflaggedSlot.fragment);

            let flaggedSpans = flaggedHost.querySelectorAll('span'),
                unflaggedSpans = unflaggedHost.querySelectorAll('span');

            for (let i = 0, n = flaggedSpans.length; i < n; i++) {
                ondisconnect(flaggedSpans[i] as unknown as Element, () => flaggedCleanups++);
                ondisconnect(unflaggedSpans[i] as unknown as Element, () => unflaggedCleanups++);
            }

            flagged.clear();
            unflagged.clear();

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(flaggedCleanups).toBe(2);
            expect(unflaggedCleanups).toBe(2);
            expect(flaggedHost.querySelectorAll('span').length).toBe(0);
            expect(unflaggedHost.querySelectorAll('span').length).toBe(0);
            // Both retain exactly the internal marker comment
            expect(flaggedHost.childNodes.length).toBe(1);
            expect(unflaggedHost.childNodes.length).toBe(1);
            expect(flaggedHost.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
            expect(unflaggedHost.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
        });

        it('clears a never-mounted flagged slot in its fragment (detached) state', async () => {
            let arr = reactive(['a', 'b'] as string[]),
                slot = new ArraySlot(arr, tmpl, true);

            expect(slot.fragment.querySelectorAll('span').length).toBe(2);

            arr.clear();

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(slot.fragment.querySelectorAll('span').length).toBe(0);
            expect(slot.fragment.childNodes.length).toBe(1);
            expect(slot.fragment.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
        });
    });
});
