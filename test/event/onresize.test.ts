import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, SlotGroup } from '../../src/types';


let dispose: (groups: SlotGroup[]) => void,
    onresize: (element: Element, listener: (element: Element) => void) => void;


function createElement(connected = true): Element {
    let element = document.createElement('div') as unknown as Element;

    Object.defineProperty(element, 'isConnected', { configurable: true, get: () => connected });

    return element;
}

function fireResize() {
    window.dispatchEvent(new Event('resize'));
}


describe('event/onresize', () => {
    let addSpy: ReturnType<typeof vi.spyOn>,
        removeSpy: ReturnType<typeof vi.spyOn>;

    // The module keeps its listener/counter state at module scope; reset the graph
    // per test so it cannot leak, then re-import onresize and the slot `dispose` it
    // registers cleanups through from the SAME fresh graph (shared CLEANUP symbol).
    beforeEach(async () => {
        vi.resetModules();

        ({ dispose } = await import('../../src/slot'));
        onresize = (await import('../../src/event/onresize')).default;

        addSpy = vi.spyOn(window, 'addEventListener');
        removeSpy = vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });

    function disconnect(element: Element) {
        dispose([{ head: element, tail: element }]);
    }

    function resizeAdds() {
        return addSpy.mock.calls.filter((args) => args[0] === 'resize').length;
    }

    function resizeRemoves() {
        return removeSpy.mock.calls.filter((args) => args[0] === 'resize').length;
    }

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
            element = createElement();

        Object.defineProperty(element, 'isConnected', { configurable: true, get: () => connected });

        onresize(element, () => { count++; });
        fireResize();

        expect(count).toBe(1);

        connected = false;
        fireResize();

        expect(count).toBe(1);

        connected = true;
        fireResize();

        expect(count).toBe(1);
    });

    it('dedup: only one window resize listener registered', () => {
        onresize(createElement(), () => {});
        onresize(createElement(), () => {});

        expect(resizeAdds()).toBe(1);
    });

    it('listener receives element as argument', () => {
        let element = createElement(),
            received: unknown = null;

        onresize(element, (el) => { received = el; });
        fireResize();

        expect(received).toBe(element);
    });

    it('cleanup removes element from listeners', () => {
        let count = 0,
            element = createElement();

        onresize(element, () => { count++; });
        fireResize();

        expect(count).toBe(1);

        disconnect(element);
        fireResize();

        expect(count).toBe(1);
    });

    it('window listener removed when all elements gone', () => {
        let element = createElement();

        onresize(element, () => {});
        disconnect(element);

        expect(resizeRemoves()).toBe(1);
    });

    it('re-registers window listener after all removed and new element added', () => {
        let element = createElement();

        onresize(element, () => {});
        disconnect(element);

        expect(resizeRemoves()).toBe(1);

        onresize(createElement(), () => {});

        expect(resizeAdds()).toBe(2);
    });
});
