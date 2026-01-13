import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ArraySlot } from '../../src/slot/array';
import { ARRAY_SLOT } from '../../src/constants';
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
});
