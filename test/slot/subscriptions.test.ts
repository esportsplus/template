import { describe, expect, it, vi } from 'vitest';
import { reactive } from '@esportsplus/reactivity';
import { subscribeArray } from '../../src/slot/subscriptions';


describe('slot/subscriptions', () => {
    it('adds and removes individual subscribers without disposing the array', () => {
        let arr = reactive(['a'] as string[]),
            received: unknown[] = [];

        let unsubscribe = subscribeArray(arr, 'push', (value) => {
            received.push(value);
        });

        arr.push('b');

        expect(received).toEqual([{ items: ['b'] }]);

        unsubscribe();
        arr.push('c');

        expect(received).toHaveLength(1);
    });

    it('keeps one dispatcher per array and event for the array lifetime', () => {
        let arr = reactive([] as string[]),
            a = vi.fn(),
            b = vi.fn();

        let offA = subscribeArray(arr, 'push', a);

        subscribeArray(arr, 'push', b);

        arr.push('x');

        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);

        offA();
        arr.push('y');

        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(2);
    });
});
