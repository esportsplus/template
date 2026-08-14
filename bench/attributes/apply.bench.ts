// Evaluated first so the raf/microtask stubs land before src modules capture the schedulers
import { flush } from '../krausest/setup';
import { read, signal, write, Signal } from '@esportsplus/reactivity';
import { bench, describe } from 'vitest';
import { setProperty } from '../../src/attributes';
import { Element } from '../../src/types';


const NAMES = ['alpha', 'beta', 'gamma'];

const NODES = 1000;


let data: Signal<number>[] = [],
    expando: Signal<number>[][] = [],
    tick = 0;


// Expando names route apply() through its terminal element[name] branch so the per-write branch chain + ownerSVGElement lookup dominate the drain
for (let i = 0; i < NODES; i++) {
    let element = document.createElement('div') as unknown as Element,
        set: Signal<number>[] = [];

    for (let j = 0, n = NAMES.length; j < n; j++) {
        let sig = signal(0);

        set.push(sig);
        setProperty(element, NAMES[j], () => read(sig));
    }

    expando.push(set);
}

for (let i = 0; i < NODES; i++) {
    let element = document.createElement('div') as unknown as Element,
        sig = signal(0);

    data.push(sig);
    setProperty(element, 'data-id', () => read(sig));
}

flush();


describe('attributes — apply drain', () => {
    bench('dense expando drain (1000 elements x 3 props)', () => {
        tick++;

        for (let i = 0; i < NODES; i++) {
            let set = expando[i];

            for (let j = 0, n = set.length; j < n; j++) {
                write(set[j], tick);
            }
        }

        flush();
    });

    bench('dense data-attribute drain (1000 elements x data-id)', () => {
        tick++;

        for (let i = 0; i < NODES; i++) {
            write(data[i], tick);
        }

        flush();
    });
});
