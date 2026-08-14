// Evaluated first so the raf/microtask stubs land before src modules capture the schedulers
import { flush } from '../krausest/setup';
import { reactive } from '@esportsplus/reactivity';
import { bench, describe } from 'vitest';
import { ArraySlot } from '../../src/slot/array';
import { dispose, remove } from '../../src/slot/cleanup';
import { SlotGroup } from '../../src/types';
import { template } from '../../src/utilities';


const ROW = template('<div><span></span></div>');


function build(n: number): number[] {
    let items = new Array<number>(n);

    for (let i = 0; i < n; i++) {
        items[i] = i;
    }

    return items;
}

function groups(n: number): SlotGroup[] {
    let pool = new Array<SlotGroup>(n);

    for (let i = 0; i < n; i++) {
        let element = document.createElement('div') as unknown as SlotGroup['head'];

        pool[i] = { head: element, tail: element };
    }

    return pool;
}

function row(value: number) {
    let fragment = ROW() as DocumentFragment;

    (fragment.firstChild!.firstChild as HTMLElement).textContent = String(value);

    return fragment;
}


// Detached single-node groups isolate the variadic signature's walk + call overhead instead of drowning it in jsdom mount cost
describe('slot/cleanup — bulk group teardown (10k detached groups)', () => {
    let pool = groups(10000);

    bench('dispose 10k groups', () => {
        dispose(...pool);
    });

    bench('remove 10k groups', () => {
        remove(...pool);
    });
});


describe('slot/array — bulk ops (regression guard)', () => {
    bench('mount 10k + clear', () => {
        let container = document.createElement('div'),
            rows = reactive(build(10000)),
            slot = new ArraySlot(rows, row as (value: number) => DocumentFragment, true);

        container.appendChild(slot.fragment);
        flush();
        rows.clear();
        flush();
    });

    bench('mount 10k + splice half', () => {
        let container = document.createElement('div'),
            rows = reactive(build(10000)),
            slot = new ArraySlot(rows, row as (value: number) => DocumentFragment, true);

        container.appendChild(slot.fragment);
        flush();
        rows.splice(2500, 5000);
        flush();
    });

    bench('mount 5k + append 5k', () => {
        let container = document.createElement('div'),
            rows = reactive(build(5000)),
            slot = new ArraySlot(rows, row as (value: number) => DocumentFragment, true);

        container.appendChild(slot.fragment);
        flush();
        rows.push(...build(5000));
        flush();
    });
});
