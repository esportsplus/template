// Evaluated first so the raf/microtask stubs land before src modules capture the schedulers
import { flush } from '../krausest/setup';
import { read, signal, write, Signal } from '@esportsplus/reactivity';
import { bench, describe } from 'vitest';
import { setProperty } from '../../src/attributes';
import { ANCHOR_SOLE } from '../../src/constants';
import { add, remove } from '../../src/event/ontick';
import { EffectSlot } from '../../src/slot/effect';
import { Element } from '../../src/types';


const NODES = 500;

const TICKS = 100;


let counter = 0,
    props: Signal<number>[] = [],
    texts: Signal<number>[] = [];


// Expando property names + text nodes keep jsdom attribute machinery out of the measurement so scheduling bookkeeping + allocation churn dominate each frame
for (let i = 0; i < NODES; i++) {
    let anchor = document.createElement('div') as unknown as Element,
        prop = signal(0),
        text = signal(0);

    props.push(prop);
    texts.push(text);

    setProperty(anchor, 'benchvalue', () => read(prop));
    new EffectSlot(anchor, () => read(text), ANCHOR_SOLE);
}

flush();


function ticks(n: number) {
    for (let i = 0; i < n; i++) {
        let fn = () => {
            counter |= 0;
            remove(fn);
        };

        add(fn);
    }
}


describe('scheduling — real drain (attributes + effect slots + ontick)', () => {
    bench('frame drain — dense (500 props + 500 slots + 100 ticks)', () => {
        counter++;

        for (let i = 0; i < NODES; i++) {
            write(props[i], counter);
            write(texts[i], counter);
        }

        ticks(TICKS);
        flush();
    });

    bench('frame drain — sparse (1% dirty)', () => {
        counter++;

        for (let i = 0; i < NODES; i += 100) {
            write(props[i], counter);
            write(texts[i], counter);
        }

        flush();
    });
});
