import { reactive, read, signal, write, ReactiveArray, Signal } from '@esportsplus/reactivity';
import { ANCHOR_SOLE } from '../../src/constants';
import { setList } from '../../src/attributes';
import { delegate } from '../../src/event';
import { ArraySlot } from '../../src/slot/array';
import { EffectSlot } from '../../src/slot/effect';
import { Element } from '../../src/types';
import { template, text } from '../../src/utilities';


type App = ReturnType<typeof create>;

type Row = {
    base: string;
    id: number;
    label: Signal<string>;
};


const ADJECTIVES = [
    'pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome',
    'plain', 'quaint', 'clean', 'elegant', 'easy', 'angry', 'crazy', 'helpful',
    'mushy', 'odd', 'unsightly', 'adorable', 'important', 'inexpensive', 'cheap', 'expensive', 'fancy'
];

const COLOURS = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown', 'white', 'black', 'orange'];

const EMPTY_STATICS: Record<string, string> = {};

const NOUNS = ['table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie', 'sandwich', 'burger', 'pizza', 'mouse', 'keyboard'];

// Hand-written equivalents of the compiler's `template()` hoists for the app + row html`` literals
// Sole-child node slots elide their <!--$--> markers (id cell text, label anchor, tbody ArraySlot)
const ROW = template('<tr><td class="col-md-1"></td><td class="col-md-4"><a></a></td><td class="col-md-1"><a><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td><td class="col-md-6"></td></tr>');

const TABLE = template('<table class="table table-hover table-striped test-data"><tbody></tbody></table>');


let id = 1,
    rows = reactive([] as Row[]),
    seed = 42,
    selected = signal(0);


function build(n: number): Row[] {
    let rows: Row[] = new Array(n);

    for (let i = 0; i < n; i++) {
        let base = `${ADJECTIVES[random(ADJECTIVES.length)]} ${COLOURS[random(COLOURS.length)]} ${NOUNS[random(NOUNS.length)]}`;

        rows[i] = { base, id: id++, label: signal(base) };
    }

    return rows;
}

// Deterministic LCG so both checkouts build identical data
function random(max: number) {
    seed = (seed * 1664525 + 1013904223) >>> 0;

    return seed % max;
}

// Shared handlers: one fn per operation for the whole table (mirrors `onclick=${[fn, data]}`
// compiler output) so rows carry per-row data instead of allocating a closure each
function removeRow(this: Element, data: Row) {
    rows.splice(rows.indexOf(data), 1);
}

function selectRow(this: Element, data: number) {
    write(selected, data);
}


const create = (container: HTMLElement) => {
    let flip = false;

    // Hand-written equivalent of the compiled row template body
    function row(data: Row) {
        let fragment = ROW(),
            tr = fragment.firstChild as Element,
            idCell = tr.firstChild as Element,
            labelCell = idCell.nextSibling as Element,
            labelLink = labelCell.firstChild as Element,
            removeLink = (labelCell.nextSibling as Element).firstChild as Element;

        setList(tr, 'class', () => signal.selector(selected, data.id) ? 'danger' : '', EMPTY_STATICS);
        idCell.appendChild(text(String(data.id)));
        delegate(labelLink, 'click', selectRow, data.id);
        new EffectSlot(labelLink, () => read(data.label), ANCHOR_SOLE);
        delegate(removeLink, 'click', removeRow, data);

        return fragment as DocumentFragment;
    }

    let fragment = TABLE(),
        table = fragment.firstChild as Element,
        tbody = table.firstChild as Element,
        slot = new ArraySlot(rows, row as (value: Row) => DocumentFragment, true);

    tbody.appendChild(slot.fragment);
    container.appendChild(fragment as unknown as Node);

    return {
        append: (n: number) => {
            rows.push(...build(n));
        },
        clear: () => {
            rows.clear();
        },
        partialUpdate: () => {
            // Toggle instead of append so label size stays stable across samples
            let suffix = (flip = !flip) ? ' !!!' : '';

            for (let i = 0, n = rows.length; i < n; i += 10) {
                write(rows[i].label, rows[i].base + suffix);
            }
        },
        remove: () => {
            rows.splice(rows.length >> 1, 1);
        },
        replace: (n: number) => {
            rows.splice(0, rows.length, ...build(n));
        },
        rows,
        select: (index: number) => {
            write(selected, rows[index].id);
        },
        swap: () => {
            if (rows.length < 999) {
                return;
            }

            let a = rows[1],
                b = rows[998],
                keyed = rows as unknown as ReactiveArray<Row>;

            keyed.$set(1, b);
            keyed.$set(998, a);
        }
    };
};


export { create };
export type { App, Row };
