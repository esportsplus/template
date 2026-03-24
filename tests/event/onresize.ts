import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '../../src/types';


let cleanups: VoidFunction[] = [];

vi.mock('@esportsplus/reactivity', async (importOriginal) => {
    let original = await importOriginal<typeof import('@esportsplus/reactivity')>();

    return {
        ...original,
        onCleanup: (fn: VoidFunction) => { cleanups.push(fn); return fn; }
    };
});


let { default: onresize } = await import('../../src/event/onresize');


function createElement(connected = true): Element {
    let element = document.createElement('div') as unknown as Element;

    Object.defineProperty(element, 'isConnected', { get: () => connected, configurable: true });

    return element;
}

function fireResize() {
    window.dispatchEvent(new Event('resize'));
}


describe('event/onresize', () => {
    let addSpy: ReturnType<typeof vi.spyOn>;
    let removeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        cleanups = [];
        addSpy = vi.spyOn(window, 'addEventListener');
        removeSpy = vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        // Run all captured cleanups to reset module state
        for (let i = 0, n = cleanups.length; i < n; i++) {
            cleanups[i]();
        }

        cleanups = [];
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });

    it('single element receives resize callback', () => {
        let called = false,
            element = createElement();

        onresize(element, () => { called = true; });
        fireResize();

        expect(called).toBe(true);
    });

    it('multiple elements all receive resize callback', () => {
        let a = 0,
            b = 0,
            elementA = createElement(),
            elementB = createElement();

        onresize(elementA, () => { a++; });
        onresize(elementB, () => { b++; });
        fireResize();

        expect(a).toBe(1);
        expect(b).toBe(1);
    });

    it('disconnected element is auto-removed during next resize', () => {
        let connected = true,
            count = 0,
            element = document.createElement('div') as unknown as Element;

        Object.defineProperty(element, 'isConnected', {
            get: () => connected,
            configurable: true
        });

        onresize(element, () => { count++; });
        fireResize();

        expect(count).toBe(1);

        connected = false;
        fireResize();

        // Should not have incremented — disconnected elements skipped
        expect(count).toBe(1);

        connected = true;
        fireResize();

        // Already removed from listeners map, should stay at 1
        expect(count).toBe(1);
    });

    it('dedup: only one window resize listener registered', () => {
        let elementA = createElement(),
            elementB = createElement();

        onresize(elementA, () => {});
        onresize(elementB, () => {});

        let resizeCalls = addSpy.mock.calls.filter(
            (args) => args[0] === 'resize'
        );

        expect(resizeCalls.length).toBe(1);
    });

    it('listener receives element as argument', () => {
        let element = createElement(),
            received: unknown = null;

        onresize(element, (el) => { received = el; });
        fireResize();

        expect(received).toBe(element);
    });

    it('onCleanup removes element from listeners', () => {
        let count = 0,
            element = createElement();

        onresize(element, () => { count++; });
        fireResize();

        expect(count).toBe(1);

        // Simulate reactive cleanup
        for (let i = 0, n = cleanups.length; i < n; i++) {
            cleanups[i]();
        }

        cleanups = [];
        fireResize();

        expect(count).toBe(1);
    });

    it('window listener removed when all elements gone', () => {
        let element = createElement(false);

        onresize(element, () => {});
        fireResize();

        let removeCalls = removeSpy.mock.calls.filter(
            (args) => args[0] === 'resize'
        );

        expect(removeCalls.length).toBe(1);
    });

    it('re-registers window listener after all removed and new element added', () => {
        let element = createElement(false);

        onresize(element, () => {});
        fireResize();

        // Window listener should be removed
        let removeCalls = removeSpy.mock.calls.filter(
            (args) => args[0] === 'resize'
        );

        expect(removeCalls.length).toBe(1);

        // Add new element — should re-register
        let element2 = createElement();

        onresize(element2, () => {});

        let addCalls = addSpy.mock.calls.filter(
            (args) => args[0] === 'resize'
        );

        expect(addCalls.length).toBe(2);
    });
});
