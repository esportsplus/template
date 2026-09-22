import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive, Reactive } from '@esportsplus/reactivity';
import { INDEX } from '../../src/virtual/measure';
import { VirtualSlot } from '../../src/virtual/slot';
import type { VirtualOptions } from '../../src/virtual/slot';


class MockResizeObserver {
    callback: ResizeObserverCallback;
    targets = new Set<Element>();


    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        observers.push(this);
    }


    disconnect() {
        this.targets.clear();
    }

    observe(target: Element) {
        this.targets.add(target);
    }

    unobserve(target: Element) {
        this.targets.delete(target);
    }
}


let observers: MockResizeObserver[] = [];


(globalThis as any).ResizeObserver = MockResizeObserver;


function deliver(pairs: [Element, number][]) {
    let groups = new Map<MockResizeObserver, any[]>();

    for (let [target, blockSize] of pairs) {
        let observer = observers.find((entry) => entry.targets.has(target)) ?? observers[0];

        if (!observer) {
            continue;
        }

        let entries = groups.get(observer) ?? [];

        entries.push({
            borderBoxSize: [{ blockSize }],
            contentBoxSize: [{ blockSize }],
            contentRect: { height: blockSize },
            target
        });
        groups.set(observer, entries);
    }

    for (let [observer, entries] of groups) {
        observer.callback(entries as unknown as ResizeObserverEntry[], observer as unknown as ResizeObserver);
    }
}

function frame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function flush() {
    await frame();
    await frame();
}


describe('virtual/VirtualSlot', () => {
    let array: Reactive<number[]>;
    let container: HTMLElement;
    let scroller: HTMLElement;
    let slots: VirtualSlot<number>[] = [];


    beforeEach(() => {
        container = document.createElement('div');
        scroller = document.createElement('div');

        scroller.style.height = '200px';
        scroller.style.overflowY = 'auto';

        container.appendChild(scroller);
        document.body.appendChild(container);
    });

    afterEach(() => {
        for (let i = 0, n = slots.length; i < n; i++) {
            slots[i].dispose();
        }

        slots = [];

        array?.dispose();

        document.body.removeChild(container);

        for (let observer of observers) {
            observer.disconnect();
        }
    });


    function setup(values: number[], options?: VirtualOptions) {
        array = reactive(values.slice());

        let slot = new VirtualSlot(array, (value) => {
            let fragment = document.createDocumentFragment(),
                row = document.createElement('div');

            row.className = 'row';
            row.setAttribute('data-index', String(value));
            fragment.appendChild(row);

            return fragment as unknown as DocumentFragment;
        }, options);

        slots.push(slot);
        scroller.appendChild(slot.fragment);

        return slot;
    }

    function rows() {
        return Array.from(scroller.querySelectorAll('.row')) as HTMLElement[];
    }

    function indexes() {
        return rows().map((row) => Number(row.getAttribute('data-index')));
    }

    function scroll(top: number) {
        scroller.scrollTop = top;
        scroller.dispatchEvent(new Event('scroll'));
    }


    describe('range', () => {
        it('computes the rendered range from measured sizes and the viewport', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200]]);
            await flush();

            let rendered = rows();

            deliver(rendered.map((row) => [row, 100] as [Element, number]));
            await flush();

            expect(slot.range).toEqual([0, 5]);
            expect(slot.length).toBe(100);
            expect(indexes()).toEqual([0, 1, 2, 3, 4]);
        });

        it('falls back to the placeholder estimate for unmeasured rows', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 400]]);
            await flush();

            expect(slot.range).toEqual([0, 5]);
            expect(indexes()).toEqual([0, 1, 2, 3, 4]);
        });

        it('overscans one viewport below when scrolling down', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            let rendered = rows();

            deliver([...rendered.map((row) => [row, 100] as [Element, number]), [scroller, 200] as [Element, number]]);
            await flush();

            rendered = rows();
            deliver(rendered.map((row) => [row, 100] as [Element, number]));
            await flush();

            scroll(250);

            expect(slot.range).toEqual([2, 7]);
            expect(indexes()).toEqual([2, 3, 4, 5, 6]);
        });

        it('overscans one viewport above when scrolling up', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            scroll(500);
            scroll(300);

            expect(slot.range).toEqual([1, 6]);
        });
    });

    describe('spacers', () => {
        it('sizes the spacers from the cache offsets', async () => {
            setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200]]);
            await flush();

            deliver(rows().map((row) => [row, 100] as [Element, number]));
            await flush();

            let spacers = scroller.querySelectorAll('div[style]');

            expect((spacers[0] as HTMLElement).style.height).toBe('0px');
            expect((spacers[1] as HTMLElement).style.height).toBe('9500px');
        });

        it('shrinks the bottom spacer after clearing the source', async () => {
            setup(Array.from({ length: 10 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200]]);
            await flush();

            deliver(rows().map((row) => [row, 100] as [Element, number]));
            await flush();

            array.clear();
            await flush();

            let spacers = scroller.querySelectorAll('div[style]');

            expect((spacers[0] as HTMLElement).style.height).toBe('0px');
            expect((spacers[1] as HTMLElement).style.height).toBe('0px');
            expect(rows().length).toBe(0);
        });
    });

    describe('table spacers', () => {
        it('uses tr spacers inside a tbody', async () => {
            let table = document.createElement('table'),
                tbody = document.createElement('tbody');

            table.appendChild(tbody);
            container.appendChild(table);

            array = reactive([1, 2, 3]);

            let slot = new VirtualSlot(array, () => {
                let fragment = document.createDocumentFragment(),
                    row = document.createElement('tr');

                row.className = 'row';
                fragment.appendChild(row);

                return fragment as unknown as DocumentFragment;
            });

            slots.push(slot);
            tbody.appendChild(slot.fragment);

            await flush();

            let spacers = tbody.querySelectorAll(':scope > tr');

            expect(spacers.length).toBeGreaterThanOrEqual(2);
            expect((spacers[0] as HTMLElement).tagName).toBe('TR');
            expect((spacers[spacers.length - 1] as HTMLElement).tagName).toBe('TR');
        });
    });

    describe('anchor: end', () => {
        async function chat(length: number) {
            let slot = setup(Array.from({ length }, (_, i) => i), { anchor: 'end' });

            await flush();

            deliver([[scroller, 200]]);
            await flush();

            deliver(rows().map((row) => [row, 100] as [Element, number]));
            await flush();

            return slot;
        }

        it('starts at the last row', async () => {
            let slot = await chat(100);

            expect(slot.range[1]).toBe(100);
            expect(scroller.scrollTop).toBe(100 * 100 - 200);
        });

        it('follows appends while the reader is at the end', async () => {
            let slot = await chat(100);

            array.push(100, 101);
            await flush();

            deliver(rows().map((row) => [row, 100] as [Element, number]));

            expect(slot.range[1]).toBe(102);
            expect(scroller.scrollTop).toBe(102 * 100 - 200);
        });

        it('targets the newest row even while an older target is still pending', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i), { anchor: 'end' });

            await flush();

            deliver([[scroller, 200]]);
            await flush();

            array.push(100);
            array.push(101);
            await flush();

            deliver(rows().map((row) => [row, 100] as [Element, number]));

            expect(slot.range[1]).toBe(102);
            expect(scroller.scrollTop).toBe(102 * 100 - 200);
        });

        it('unpins on an explicit scrollTo and re-pins when it lands at the end', async () => {
            let slot = await chat(100);

            slot.scrollTo(10);
            deliver(rows().map((row) => [row, 100] as [Element, number]));

            let top = scroller.scrollTop;

            array.push(100);
            await flush();

            expect(scroller.scrollTop).toBe(top);

            slot.scrollTo(100, 'end');
            deliver(rows().map((row) => [row, 100] as [Element, number]));
            array.push(101);
            await flush();
            deliver(rows().map((row) => [row, 100] as [Element, number]));

            expect(slot.range[1]).toBe(102);
            expect(scroller.scrollTop).toBe(102 * 100 - 200);
        });

        it('leaves the viewport alone once the reader has scrolled up', async () => {
            let slot = await chat(100);

            scroll(5000);
            deliver(rows().map((row) => [row, 100] as [Element, number]));

            let range = slot.range;

            array.push(100, 101);
            await flush();

            expect(scroller.scrollTop).toBe(5000);
            expect(slot.range).toEqual(range);
        });

        it('re-engages when the reader returns to the end', async () => {
            let slot = await chat(100);

            scroll(5000);
            scroll(100 * 100 - 200);
            deliver(rows().map((row) => [row, 100] as [Element, number]));

            array.push(100);
            await flush();

            expect(slot.range[1]).toBe(101);
            expect(scroller.scrollTop).toBe(101 * 100 - 200);
        });
    });

    describe('resize compensation', () => {
        async function measured(length: number) {
            let slot = setup(Array.from({ length }, (_, i) => i));

            await flush();

            deliver([[scroller, 200]]);
            await flush();

            deliver(rows().map((row) => [row, 100] as [Element, number]));
            await flush();

            return slot;
        }

        it('applies a scroll jump when a row above the window grows', async () => {
            let slot = await measured(100),
                first = scroller.querySelector('.row[data-index="0"]') as HTMLElement;

            scroll(250);
            deliver(rows().map((row) => [row, 100] as [Element, number]));

            let range = slot.range;

            deliver([[first, 150]]);

            expect(scroller.scrollTop).toBe(300);
            expect(slot.range).toEqual(range);
        });

        it('never jumps for a row inside the window, even during a backward scroll', async () => {
            let slot = await measured(100);

            scroll(450);
            deliver(rows().map((row) => [row, 100] as [Element, number]));
            scroll(400);
            deliver(rows().map((row) => [row, 100] as [Element, number]));

            let [start] = slot.range,
                top = scroller.querySelector(`.row[data-index="${start}"]`) as HTMLElement;

            deliver([[top, 150]]);

            expect(scroller.scrollTop).toBe(400);
        });

        it('follows estimate drift that moves unmeasured rows above the window', async () => {
            let slot = setup(Array.from({ length: 1000 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200]]);
            await flush();

            scroll(20000);

            let [start] = slot.range,
                before = scroller.scrollTop,
                sizes = rows().map((row) => [row, 40] as [Element, number]);

            deliver(sizes);

            let [after] = slot.range;

            expect(after).toBe(start);
            expect(scroller.scrollTop).toBeLessThan(before);
            expect(scroller.scrollTop).toBe(start * 40);
        });

        it('runs one commit per observer batch', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            let commit = vi.spyOn(slot, 'commit');

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);

            expect(commit).toHaveBeenCalledTimes(1);

            commit.mockRestore();
        });
    });

    describe('source mutations', () => {
        it('maps push onto the cache and rendered window', async () => {
            let slot = setup(Array.from({ length: 10 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            array.push(10);
            await flush();

            expect(slot.length).toBe(11);
            expect(slot.range).toEqual([0, 5]);
        });

        it('maps splice onto the cache and patches rendered content', async () => {
            let slot = setup(Array.from({ length: 10 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            array.splice(1, 1);
            await flush();

            expect(slot.length).toBe(9);
            expect(indexes()).toEqual([0, 2, 3, 4, 5]);
        });

        it('reorders the cache and window after sort', async () => {
            let slot = setup([3, 1, 2, 5, 4]);

            await flush();

            deliver([[scroller, 500], ...rows().map((row) => [row, 50] as [Element, number])]);
            await flush();

            array.sort((a, b) => a - b);
            await flush();

            expect(slot.length).toBe(5);
            expect(indexes()).toEqual([1, 2, 3, 4, 5]);
        });

        it('empties the window after clear', async () => {
            let slot = setup(Array.from({ length: 10 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            array.clear();
            await flush();

            expect(slot.length).toBe(0);
            expect(slot.range).toEqual([0, 0]);
            expect(rows().length).toBe(0);
        });

        it('keeps the same row elements when a splice lands above the window', async () => {
            setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            scroll(2000);

            let before = rows(),
                beforeIndexes = before.map((row) => (row as any)[INDEX] as number);

            expect(before.length).toBe(5);
            expect(beforeIndexes).toEqual([20, 21, 22, 23, 24]);

            array.splice(5, 2);
            await flush();

            let after = rows();

            expect(after.length).toBe(5);
            expect(after.map((row) => Number(row.getAttribute('data-index')))).toEqual(before.map((row) => Number(row.getAttribute('data-index'))));

            for (let i = 0; i < after.length; i++) {
                expect(after[i]).toBe(before[i]);
            }

            expect(after.map((row) => (row as any)[INDEX] as number)).toEqual([18, 19, 20, 21, 22]);
        });
    });

    describe('non-overlapping replacement', () => {
        it('replaces the whole window when ranges do not overlap', async () => {
            let slot = setup(Array.from({ length: 1000 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            expect(indexes()).toEqual([0, 1, 2, 3, 4]);

            scroll(50000);

            expect(slot.range[0]).toBe(500);
            expect(indexes()).toEqual([500, 501, 502, 503, 504]);
        });
    });

    describe('scrollTo', () => {
        it('writes the offset for a measured target', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            slot.scrollTo(50);

            expect(scroller.scrollTop).toBe(5000);
            expect(slot.range[0]).toBe(50);
        });

        it('converges after the target rows are measured', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            slot.scrollTo(50);

            deliver(rows().map((row) => [row, 200] as [Element, number]));

            slot.scrollTo(50);
            let first = scroller.scrollTop;

            slot.scrollTo(50);
            let second = scroller.scrollTop;

            expect(second).toBe(first);
            expect(slot.range[0]).toBe(50);
        });

        it('clamps to the end of the list', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            slot.scrollTo(500);

            expect(scroller.scrollTop).toBe(9800);
        });

        it('reads the clamped scroll position back after a programmatic write', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            let actual = 0;

            Object.defineProperty(scroller, 'scrollTop', {
                configurable: true,
                get: () => actual,
                set: (value: number) => {
                    actual = Math.min(value, 500);
                }
            });

            let commit = vi.spyOn(slot, 'commit');

            slot.scrollTo(99, 'end');

            expect(scroller.scrollTop).toBe(500);
            expect(slot.range[0]).toBe(5);

            commit.mockClear();

            scroller.dispatchEvent(new Event('scroll'));

            expect(commit).not.toHaveBeenCalled();

            commit.mockRestore();
        });

        it('converges on the end as measurements arrive in observer batches', async () => {
            let slot = setup(Array.from({ length: 1000 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200]]);
            await flush();

            slot.scrollTo(999, 'end');

            deliver(rows().map((row) => [row, 50] as [Element, number]));
            await flush();

            deliver(rows().map((row) => [row, 50] as [Element, number]));
            await flush();

            expect(scroller.scrollTop).toBe(50000 - 200);
            expect(slot.range[1]).toBe(1000);
        });
    });

    describe('disposal', () => {
        it('releases observers, listeners, and spacers', async () => {
            let slot = setup(Array.from({ length: 100 }, (_, i) => i));

            await flush();

            deliver([[scroller, 200], ...rows().map((row) => [row, 100] as [Element, number])]);
            await flush();

            let remove = vi.spyOn(scroller, 'removeEventListener'),
                range = slot.range;

            slot.dispose();

            expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
            expect(observers.every((observer) => !observer.targets.has(scroller))).toBe(true);
            expect(scroller.querySelectorAll('div[style]').length).toBe(0);

            scroll(500);

            expect(slot.range).toEqual(range);

            remove.mockRestore();
        });
    });
});
