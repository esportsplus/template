import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLEANUP } from '../../src/constants';
import { effect, flush, onCleanup, read, root, signal, write } from '@esportsplus/reactivity';
import type { Element } from '../../src/types';


let callbacks: VoidFunction[] = [];

vi.mock('../../src/utilities', async (importOriginal) => {
    let original = await importOriginal<typeof import('../../src/utilities')>();

    return {
        ...original,
        raf: (cb: VoidFunction) => { callbacks.push(cb); }
    };
});


let { default: onfirstpaint } = await import('../../src/event/onfirstpaint');


describe('event/onfirstpaint', () => {
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

    it('calls listener on the frame after the one that finds the element connected', () => {
        let called = false,
            element = document.createElement('div') as unknown as Element;

        container.appendChild(element as unknown as Node);

        onfirstpaint(element, () => { called = true; });
        advanceFrame();

        expect(called).toBe(false);

        advanceFrame();

        expect(called).toBe(true);
    });

    it('waits for the element to connect, then one frame more', () => {
        let called = false,
            element = document.createElement('div') as unknown as Element;

        onfirstpaint(element, () => { called = true; });

        for (let i = 0; i < 10; i++) {
            advanceFrame();
        }

        expect(called).toBe(false);

        container.appendChild(element as unknown as Node);
        advanceFrame();

        expect(called).toBe(false);

        advanceFrame();

        expect(called).toBe(true);
    });

    it('never calls listener if element does not connect within 60 frames', () => {
        let called = false,
            element = document.createElement('div') as unknown as Element;

        onfirstpaint(element, () => { called = true; });

        for (let i = 0; i < 62; i++) {
            advanceFrame();
        }

        container.appendChild(element as unknown as Node);
        advanceFrame();
        advanceFrame();

        expect(called).toBe(false);
    });

    it('passes element as argument to listener, once', () => {
        let count = 0,
            element = document.createElement('div') as unknown as Element,
            received: unknown = null;

        container.appendChild(element as unknown as Node);

        onfirstpaint(element, (el) => {
            count++;
            received = el;
        });

        for (let i = 0; i < 5; i++) {
            advanceFrame();
        }

        expect(count).toBe(1);
        expect(received).toBe(element);
    });

    it('stops waiting once the element is disposed', () => {
        let called = false,
            element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown };

        container.appendChild(element);

        onfirstpaint(element as unknown as Element, () => { called = true; });
        advanceFrame();

        let cleanups = element[CLEANUP] as VoidFunction[];

        for (let i = 0, n = cleanups.length; i < n; i++) {
            cleanups[i]();
        }

        advanceFrame();
        advanceFrame();

        expect(called).toBe(false);
        expect(callbacks.length).toBe(0);
    });

    describe('ownership', () => {
        it('runs the listener untracked, in a root released with the owner of the element', () => {
            let disposeOwner = () => {},
                element = document.createElement('div') as unknown as Element,
                runs = 0,
                released = vi.fn(),
                s = signal(0);

            container.appendChild(element as unknown as Node);
            root((dispose) => {
                disposeOwner = dispose;
                onfirstpaint(element, () => {
                    read(s);
                    onCleanup(released);
                    effect(() => { runs++; read(s); });
                });
            });
            advanceFrame();
        advanceFrame();

            expect(runs).toBe(1);

            write(s, 1);
            flush();

            expect(runs).toBe(2);
            expect(released).not.toHaveBeenCalled();

            disposeOwner();
            write(s, 2);
            flush();

            expect(runs).toBe(2);
            expect(released).toHaveBeenCalledTimes(1);
        });

        it('stops waiting once its owner is released before the element connects', () => {
            let called = false,
                disposeOwner = () => {},
                element = document.createElement('div') as unknown as Element;

            root((dispose) => {
                disposeOwner = dispose;
                onfirstpaint(element, () => { called = true; });
            });
            disposeOwner();
            container.appendChild(element as unknown as Node);
            advanceFrame();
            advanceFrame();

            expect(called).toBe(false);
            expect(callbacks.length).toBe(0);
        });
    });
});
