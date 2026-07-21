// Evaluated first so the raf/microtask stubs land before src modules capture the schedulers
import { flush } from '../krausest/setup';
import { reactive, read, signal, ReactiveArray, Signal } from '@esportsplus/reactivity';
import { bench, describe } from 'vitest';
import { ANCHOR_SOLE } from '../../src/constants';
import { ArraySlot } from '../../src/slot/array';
import { EffectSlot } from '../../src/slot/effect';
import { Element } from '../../src/types';
import { template } from '../../src/utilities';


type Row = {
    id: number;
    label: Signal<string>;
};


const ROW = template('<tr><td></td><td><a></a></td></tr>');

const SIZE = 1000;


let id = 0,
    rows = reactive([] as Row[]);


function build(n: number): Row[] {
    let items = new Array<Row>(n);

    for (let i = 0; i < n; i++) {
        items[i] = { id: id++, label: signal('row ' + id) };
    }

    return items;
}

function row(data: Row) {
    let fragment = ROW() as DocumentFragment,
        tr = fragment.firstChild as Element,
        idCell = tr.firstChild as Element,
        labelLink = (idCell.nextSibling as Element).firstChild as Element;

    idCell.textContent = String(data.id);
    new EffectSlot(labelLink, () => read(data.label), ANCHOR_SOLE);

    return fragment;
}

// Row-count guard: the baseline set path can drop groups, which would degenerate
// later iterations into empty-table ops and invalidate the comparison
function reset() {
    if (rows.length !== SIZE) {
        rows.splice(0, rows.length, ...build(SIZE));
        flush();
    }
}


let container = document.createElement('div'),
    keyed = rows as unknown as ReactiveArray<Row>,
    slot = new ArraySlot(rows, row as (value: Row) => DocumentFragment, true);

container.appendChild(slot.fragment);
rows.push(...build(SIZE));
flush();


describe('slot/array — keyed set', () => {
    bench('set same item at index 0 (no-op set)', () => {
        reset();
        keyed.$set(0, rows[0]);
        flush();
    });

    bench('swap rows 1 and 998 (krausest swap)', () => {
        reset();

        let a = rows[1],
            b = rows[998];

        keyed.$set(1, b);
        keyed.$set(998, a);
        flush();
    });
});
