import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '../../src/types';


let callbacks: VoidFunction[] = [];

vi.mock('../../src/utilities', async (importOriginal) => {
    let original = await importOriginal<typeof import('../../src/utilities')>();

    return {
        ...original,
        raf: (cb: VoidFunction) => { callbacks.push(cb); }
    };
});


let { default: onconnect } = await import('../../src/event/onconnect');


describe('event/onconnect', () => {
    let container: HTMLElement;

    beforeEach(() => {
        callbacks = [];
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        // Drain the RAF loop so tasks.running resets between tests
        for (let i = 0; i < 65; i++) {
            advanceFrame();
        }

        callbacks = [];
        document.body.removeChild(container);
    });

    function advanceFrame() {
        let current = callbacks.slice();

        callbacks = [];

        for (let i = 0, n = current.length; i < n; i++) {
            current[i]();
        }
    }

    it('calls listener on first tick when element is already connected', () => {
        let called = false,
            element = document.createElement('div') as unknown as Element;

        container.appendChild(element as unknown as Node);

        onconnect(element, () => { called = true; });
        advanceFrame();

        expect(called).toBe(true);
    });

    it('calls listener after element connects on tick N', () => {
        let called = false,
            element = document.createElement('div') as unknown as Element;

        onconnect(element, () => { called = true; });

        // Advance 10 frames without connecting
        for (let i = 0; i < 10; i++) {
            advanceFrame();
        }

        expect(called).toBe(false);

        // Connect element
        container.appendChild(element as unknown as Node);
        advanceFrame();

        expect(called).toBe(true);
    });

    it('never calls listener if element does not connect within 60 ticks', () => {
        let called = false,
            element = document.createElement('div') as unknown as Element;

        onconnect(element, () => { called = true; });

        // Advance 62 frames — retry decrements from 60, at 0 it removes
        for (let i = 0; i < 62; i++) {
            advanceFrame();
        }

        expect(called).toBe(false);

        // Verify polling stopped — connecting now should have no effect
        container.appendChild(element as unknown as Node);
        advanceFrame();
        advanceFrame();

        expect(called).toBe(false);
    });

    it('passes element as argument to listener', () => {
        let element = document.createElement('div') as unknown as Element,
            received: unknown = null;

        container.appendChild(element as unknown as Node);

        onconnect(element, (el) => { received = el; });
        advanceFrame();

        expect(received).toBe(element);
    });

    it('calls listener only once', () => {
        let count = 0,
            element = document.createElement('div') as unknown as Element;

        container.appendChild(element as unknown as Node);

        onconnect(element, () => { count++; });

        advanceFrame();
        advanceFrame();
        advanceFrame();

        expect(count).toBe(1);
    });

    it('stops polling after listener is called', () => {
        let element = document.createElement('div') as unknown as Element,
            listenerCalled = false;

        container.appendChild(element as unknown as Node);

        onconnect(element, () => { listenerCalled = true; });
        advanceFrame();

        expect(listenerCalled).toBe(true);

        // After listener fires and task is removed, further frames should not re-add
        advanceFrame();
        advanceFrame();

        // If no tasks remain, callbacks should be empty after the last frame processes
        expect(callbacks.length).toBe(0);
    });
});
