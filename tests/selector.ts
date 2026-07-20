import { describe, expect, it } from 'vitest';
import { effect, flush, signal, write } from '@esportsplus/reactivity';
import type { Signal } from '@esportsplus/reactivity';


describe('signal.selector', () => {
    it('exposes selector as a method on the barrel-exported signal', () => {
        expect(typeof signal.selector).toBe('function');
    });

    it('re-runs only the leaving and entering key effects on write (O(2))', () => {
        const N = 64;

        let counters = new Array<number>(N).fill(0),
            disposers: VoidFunction[] = [],
            source = signal(0);

        for (let k = 0; k < N; k++) {
            let key = k;

            disposers.push(effect(() => {
                signal.selector(source, key);
                counters[key]++;
            }));
        }

        expect(counters.every((c) => c === 1)).toBe(true);

        write(source, 5);
        flush();

        expect(counters[0]).toBe(2);
        expect(counters[5]).toBe(2);

        for (let k = 0; k < N; k++) {
            if (k === 0 || k === 5) {
                continue;
            }

            expect(counters[k]).toBe(1);
        }

        for (let i = 0, n = disposers.length; i < n; i++) {
            disposers[i]();
        }
    });

    it('natively evicts per-key entries when their last subscriber disposes', () => {
        const N = 50;

        let disposers: VoidFunction[] = [],
            source = signal(0) as Signal<number>;

        for (let k = 0; k < N; k++) {
            let key = k;

            disposers.push(effect(() => {
                signal.selector(source, key);
            }));
        }

        expect(source.keys?.size).toBe(N);

        for (let i = 0, n = disposers.length; i < n; i++) {
            disposers[i]();
        }

        expect(source.keys).toBeNull();
    });

    it('stays bounded across repeated subscribe/dispose cycles', () => {
        const CYCLES = 5,
            N = 50;

        let source = signal(0) as Signal<number>;

        for (let c = 0; c < CYCLES; c++) {
            let disposers: VoidFunction[] = [];

            for (let k = 0; k < N; k++) {
                let key = k;

                disposers.push(effect(() => {
                    signal.selector(source, key);
                }));
            }

            expect(source.keys?.size).toBe(N);

            for (let i = 0, n = disposers.length; i < n; i++) {
                disposers[i]();
            }

            expect(source.keys).toBeNull();
        }
    });
});
