import { afterEach, describe, expect, it, vi } from 'vitest';
import { root } from '@esportsplus/reactivity';
import { CLEANUP } from '../../src/constants';
import type { Slot } from '../../src/slot/cleanup';


// The production build of env: what a bundle without the development condition resolves
vi.mock('@esportsplus/template/env', () => ({ DEV: false }));


let { adopt, ondisconnect, sweep, track } = await import('../../src/slot/cleanup');


afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
});


describe('slot/cleanup in production', () => {
    it('schedules no sweep for a tracked slot or ownerless cleanup', () => {
        using idle = vi.fn();
        using timeout = vi.spyOn(globalThis, 'setTimeout');

        vi.stubGlobal('requestIdleCallback', idle);

        let element = document.createElement('div'),
            slot: Slot = { anchor: element, disposed: false, parent: null, release: () => {}, state: 0 };

        document.body.append(element);
        track(slot);
        ondisconnect(element, () => {});

        expect(timeout).not.toHaveBeenCalled();
        expect(idle).not.toHaveBeenCalled();
        expect(slot.state).toBe(0);
    });

    it('releases nothing foreign code removed', () => {
        let element = document.createElement('div'),
            released = 0,
            slot: Slot = { anchor: element, disposed: false, parent: null, release: () => { released++; }, state: 0 };

        document.body.append(element);
        track(slot);
        sweep();
        element.remove();
        sweep();

        expect(released).toBe(0);
    });

    it('still hands ownerless cleanups to the owner that adopts their content', () => {
        let calls = 0,
            fn = () => { calls++; },
            host = document.createElement('section'),
            element = document.createElement('div');

        host.append(element);
        ondisconnect(element, fn);

        expect((element as unknown as Record<symbol, unknown>)[CLEANUP]).toEqual([fn]);

        let dispose = root((stop) => {
            adopt(host);

            return stop;
        });

        expect((element as unknown as Record<symbol, unknown>)[CLEANUP]).toBeUndefined();

        dispose();

        expect(calls).toBe(1);
    });
});
