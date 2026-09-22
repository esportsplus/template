import { reactive } from '@esportsplus/reactivity';
import { ArraySlot } from '../../src/slot/array';
import { template, text } from '../../src/utilities';
import { VirtualSlot } from '../../src/virtual';


type App = ReturnType<typeof create>;

type Row = {
    element?: HTMLDivElement;
    height: number;
    label: string;
};


const MAX_HEIGHT = 240;

const MIN_HEIGHT = 24;

const ROW = template('<div class="row"><span class="label"></span></div>');

const ROWS = 100000;

const SEED = 42;

const SPLICE_ROWS = 1000;

const SPLICE_SEED = 9001;


let id = 1,
    seed = SEED;


function build(n: number): Row[] {
    let rows = new Array<Row>(n);

    for (let i = 0; i < n; i++) {
        let height = MIN_HEIGHT + random(MAX_HEIGHT - MIN_HEIGHT + 1);

        rows[i] = {
            height,
            label: `Row ${id++} (${height}px)`
        };
    }

    return rows;
}

// Deterministic LCG so both variants build identical rows
function random(max: number) {
    seed = (seed * 1664525 + 1013904223) >>> 0;

    return seed % max;
}

function row(data: Row): DocumentFragment {
    let fragment = ROW() as DocumentFragment,
        element = fragment.firstChild as HTMLDivElement,
        label = element.firstChild as HTMLSpanElement;

    data.element = element;
    element.style.boxSizing = 'border-box';
    element.style.height = data.height + 'px';
    element.style.padding = '0 12px';
    label.appendChild(text(data.label));

    return fragment;
}


const create = (container: HTMLElement, virtual: boolean) => {
    seed = SEED;

    let rows = reactive(build(ROWS)),
        scroller = document.createElement('div');

    scroller.style.height = '800px';
    scroller.style.overflow = 'auto';

    let virtualSlot = virtual ? new VirtualSlot(rows, row) : null,
        arraySlot = virtual ? null : new ArraySlot(rows, row),
        original = new Map<Row, number>(),
        spliced = 0;

    scroller.appendChild((virtualSlot ?? arraySlot)!.fragment);
    container.appendChild(scroller);

    function indexAt(top: number) {
        let offset = 0;

        for (let i = 0, n = rows.length; i < n; i++) {
            offset += rows[i].height;

            if (offset > top) {
                return i;
            }
        }

        return rows.length - 1;
    }

    function resize(target: Row, height: number) {
        target.height = height;

        if (target.element) {
            target.element.style.height = height + 'px';
        }
    }

    function scroll(value: number) {
        scroller.scrollTop = value;
        scroller.dispatchEvent(new Event('scroll'));
    }

    return {
        dispose: () => {
            virtualSlot?.dispose();
            arraySlot?.dispose();
        },
        dragToMiddle: () => {
            scroll((scroller.scrollHeight - scroller.clientHeight) / 2);
        },
        expandAboveViewport: () => {
            if (!rows.length) {
                return;
            }

            let edge = scroller.getBoundingClientRect().top,
                start = indexAt(scroller.scrollTop),
                target: Row | null = null;

            for (let i = start - 1; i >= 0 && i > start - 8; i--) {
                let candidate = rows[i];

                if (candidate.element?.isConnected && candidate.element.getBoundingClientRect().bottom <= edge) {
                    target = candidate;
                    break;
                }
            }

            if (!target) {
                for (let i = start; i < rows.length && i < start + 8; i++) {
                    let candidate = rows[i];

                    if (candidate.element?.isConnected) {
                        target = candidate;
                        break;
                    }
                }
            }

            if (target) {
                original.set(target, target.height);
                resize(target, target.height * 2);
            }
        },
        reset: () => {
            if (spliced) {
                rows.splice(0, spliced);
                spliced = 0;
            }

            for (let [target, height] of original) {
                resize(target, height);
            }

            original.clear();

            scroller.scrollTop = 0;
        },
        scroller,
        scrollToEnd: () => {
            scroll(scroller.scrollHeight);
        },
        scrollToFraction: (fraction: number) => {
            scroll((scroller.scrollHeight - scroller.clientHeight) * fraction);
        },
        scrollToIndex: (index: number) => {
            if (virtualSlot) {
                virtualSlot.scrollTo(index);
                scroller.dispatchEvent(new Event('scroll'));
                return;
            }

            let offset = 0;

            for (let i = 0, n = Math.min(index, rows.length); i < n; i++) {
                offset += rows[i].height;
            }

            scroll(offset);
        },
        spliceAboveViewport: () => {
            seed = SPLICE_SEED;

            rows.splice(0, 0, ...build(SPLICE_ROWS));

            spliced += SPLICE_ROWS;
        },
        wheel: (delta: number) => {
            scroll(scroller.scrollTop + delta);
        }
    };
};


export { create };
export type { App, Row };
