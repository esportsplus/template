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


// Must import after mock setup
let { add, remove } = await import('../../src/event/ontick');
let { default: ontick } = await import('../../src/event/ontick');


describe('event/ontick', () => {
    beforeEach(() => {
        callbacks = [];
    });

    afterEach(() => {
        callbacks = [];
    });

    function advanceFrame() {
        let current = callbacks.slice();

        callbacks = [];

        for (let i = 0, n = current.length; i < n; i++) {
            current[i]();
        }
    }

    describe('add', () => {
        it('schedules task to run in RAF', () => {
            let called = false,
                task = () => { called = true; };

            add(task);
            advanceFrame();

            expect(called).toBe(true);

            remove(task);
            advanceFrame();
        });

        it('task runs on each frame while added', () => {
            let count = 0,
                task = () => { count++; };

            add(task);

            advanceFrame();
            advanceFrame();
            advanceFrame();

            expect(count).toBe(3);

            remove(task);
            advanceFrame();
        });
    });

    describe('remove', () => {
        it('stops task execution', () => {
            let count = 0,
                task = () => { count++; };

            add(task);
            advanceFrame();

            expect(count).toBe(1);

            remove(task);
            advanceFrame();

            expect(count).toBe(1);

            advanceFrame();
        });

        it('RAF loop stops when no tasks remain', () => {
            let task = () => {};

            add(task);
            advanceFrame();
            remove(task);
            advanceFrame();

            // After tick sees no tasks, it should not schedule another raf
            expect(callbacks.length).toBe(0);
        });
    });

    describe('multiple tasks', () => {
        it('all execute per frame', () => {
            let a = 0,
                b = 0,
                taskA = () => { a++; },
                taskB = () => { b++; };

            add(taskA);
            add(taskB);
            advanceFrame();

            expect(a).toBe(1);
            expect(b).toBe(1);

            remove(taskA);
            remove(taskB);
            advanceFrame();
        });
    });

    describe('add then remove same task', () => {
        it('no execution after immediate remove', () => {
            let called = false,
                task = () => { called = true; };

            add(task);
            remove(task);
            advanceFrame();

            expect(called).toBe(false);
        });
    });

    describe('ontick', () => {
        let container: HTMLElement;

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });

        afterEach(() => {
            document.body.removeChild(container);
        });

        it('calls listener when element is connected', () => {
            let element = document.createElement('div') as unknown as Element,
                called = false,
                storedDispose: VoidFunction | null = null;

            container.appendChild(element as unknown as Node);

            ontick(element, (dispose) => { called = true; storedDispose = dispose; });
            advanceFrame();

            expect(called).toBe(true);

            storedDispose!();
            advanceFrame();
        });

        it('listener receives dispose function and element', () => {
            let element = document.createElement('div') as unknown as Element,
                receivedDispose: VoidFunction | null = null,
                receivedElement: unknown = null;

            container.appendChild(element as unknown as Node);

            ontick(element, (dispose, el) => {
                receivedDispose = dispose;
                receivedElement = el;
            });
            advanceFrame();

            expect(typeof receivedDispose).toBe('function');
            expect(receivedElement).toBe(element);

            receivedDispose!();
            advanceFrame();
        });

        it('auto-removes when element disconnects', () => {
            let callCount = 0,
                element = document.createElement('div') as unknown as Element;

            container.appendChild(element as unknown as Node);

            ontick(element, () => { callCount++; });
            advanceFrame();

            expect(callCount).toBe(1);

            container.removeChild(element as unknown as Node);
            advanceFrame();

            let afterDisconnect = callCount;

            advanceFrame();

            expect(callCount).toBe(afterDisconnect);
        });

        it('retries up to 60 times for connection', () => {
            let called = false,
                element = document.createElement('div') as unknown as Element,
                storedDispose: VoidFunction | null = null;

            // Not connected to DOM
            ontick(element, (dispose) => { called = true; storedDispose = dispose; });

            // Advance 59 frames without connecting — should not call or remove
            for (let i = 0; i < 59; i++) {
                advanceFrame();
            }

            expect(called).toBe(false);

            // Connect before 60th retry
            container.appendChild(element as unknown as Node);
            advanceFrame();

            expect(called).toBe(true);

            storedDispose!();
            advanceFrame();
        });

        it('removes after 60 retries if never connected', () => {
            let callCount = 0,
                element = document.createElement('div') as unknown as Element;

            // Not connected to DOM
            ontick(element, () => { callCount++; });

            // Advance 61 frames — retry=60, counts down each frame, at 0 it removes
            for (let i = 0; i < 62; i++) {
                advanceFrame();
            }

            expect(callCount).toBe(0);

            // Verify task was removed — no further calls even if we keep ticking
            advanceFrame();
            advanceFrame();

            expect(callCount).toBe(0);
        });

        it('dispose function stops execution', () => {
            let callCount = 0,
                element = document.createElement('div') as unknown as Element,
                storedDispose: VoidFunction | null = null;

            container.appendChild(element as unknown as Node);

            ontick(element, (dispose) => {
                callCount++;
                storedDispose = dispose;
            });

            advanceFrame();

            expect(callCount).toBe(1);

            storedDispose!();
            advanceFrame();

            expect(callCount).toBe(1);
        });
    });
});
