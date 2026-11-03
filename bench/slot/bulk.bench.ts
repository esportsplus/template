// Evaluated first so the raf/microtask stubs land before src modules capture the schedulers
import { flush } from '../krausest/setup';
import { reactive } from '@esportsplus/reactivity';
import { test } from 'vitest';
import { ArraySlot } from '../../src/slot/array';
import { template } from '../../src/utilities';


const ROW = template('<div><span></span></div>');


// What a sample mounted, released after it untimed: in development every top-level slot is tracked until a sweep
// drops it, and a synchronous bench loop never yields to one, so each sample's rows would stay reachable
let mounted: { container: Element; slot: ArraySlot<number> } | null = null;


function build(n: number): number[] {
    // oxlint-disable-next-line unicorn/no-new-array -- preallocated to its final length, every slot is written next
    let items = new Array<number>(n);

    for (let i = 0; i < n; i++) {
        items[i] = i;
    }

    return items;
}

function release(): void {
    if (mounted === null) {
        return;
    }

    mounted.slot.dispose();
    mounted.container.textContent = '';
    mounted = null;
}

function row(value: number) {
    let fragment = ROW() as DocumentFragment;

    (fragment.firstChild!.firstChild as HTMLElement).textContent = String(value);

    return fragment;
}


test('slot/array — bulk ops (regression guard)', async ({ bench }) => {
    await bench.compare(
        bench('mount 10k + clear', { afterEach: release }, () => {
            let container = document.createElement('div'),
                rows = reactive(build(10000)),
                slot = new ArraySlot(rows, row as (value: number) => DocumentFragment, true);

            mounted = { container, slot };
            container.appendChild(slot.fragment);
            flush();
            rows.clear();
            flush();
        }),
        bench('mount 10k + splice half', { afterEach: release }, () => {
            let container = document.createElement('div'),
                rows = reactive(build(10000)),
                slot = new ArraySlot(rows, row as (value: number) => DocumentFragment, true);

            mounted = { container, slot };
            container.appendChild(slot.fragment);
            flush();
            rows.splice(2500, 5000);
            flush();
        }),
        bench('mount 5k + append 5k', { afterEach: release }, () => {
            let container = document.createElement('div'),
                rows = reactive(build(5000)),
                slot = new ArraySlot(rows, row as (value: number) => DocumentFragment, true);

            mounted = { container, slot };
            container.appendChild(slot.fragment);
            flush();
            rows.push(...build(5000));
            flush();
        })
    );
});
