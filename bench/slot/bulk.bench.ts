// Evaluated first so the raf/microtask stubs land before src modules capture the schedulers
import { flush } from '../krausest/setup';
import { reactive } from '@esportsplus/reactivity';
import { test } from 'vitest';
import { ArraySlot } from '../../src/slot/array';
import { template } from '../../src/utilities';


const ROW = template('<div><span></span></div>');


function build(n: number): number[] {
    let items = new Array<number>(n);

    for (let i = 0; i < n; i++) {
        items[i] = i;
    }

    return items;
}

function row(value: number) {
    let fragment = ROW() as DocumentFragment;

    (fragment.firstChild!.firstChild as HTMLElement).textContent = String(value);

    return fragment;
}


test('slot/array — bulk ops (regression guard)', async ({ bench }) => {
    await bench.compare(
        bench('mount 10k + clear', () => {
            let container = document.createElement('div'),
                rows = reactive(build(10000)),
                slot = new ArraySlot(rows, row as (value: number) => DocumentFragment, true);

            container.appendChild(slot.fragment);
            flush();
            rows.clear();
            flush();
        }),
        bench('mount 10k + splice half', () => {
            let container = document.createElement('div'),
                rows = reactive(build(10000)),
                slot = new ArraySlot(rows, row as (value: number) => DocumentFragment, true);

            container.appendChild(slot.fragment);
            flush();
            rows.splice(2500, 5000);
            flush();
        }),
        bench('mount 5k + append 5k', () => {
            let container = document.createElement('div'),
                rows = reactive(build(5000)),
                slot = new ArraySlot(rows, row as (value: number) => DocumentFragment, true);

            container.appendChild(slot.fragment);
            flush();
            rows.push(...build(5000));
            flush();
        })
    );
});
