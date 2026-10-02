import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { remove } from '../../src/slot/cleanup';
import onactive from '../../src/event/onactive';
import type { Element } from '../../src/types';


function pointer(type: string, pointerType: string) {
    return Object.assign(new Event(type), { pointerType });
}


describe('event/onactive', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    describe('touch', () => {
        it('listens only between a touch press and the last finger lifting', () => {
            let calls = 0,
                element = document.createElement('div') as unknown as Element;

            container.appendChild(element as unknown as Node);
            onactive(element, 'touchmove', () => { calls++; });

            element.dispatchEvent(new TouchEvent('touchmove'));
            expect(calls).toBe(0);

            element.dispatchEvent(pointer('pointerdown', 'touch'));
            element.dispatchEvent(new TouchEvent('touchmove'));
            expect(calls).toBe(1);

            element.dispatchEvent(new TouchEvent('touchend'));
            element.dispatchEvent(new TouchEvent('touchmove'));
            expect(calls).toBe(1);
        });

        it('is cancelable while bound', () => {
            let element = document.createElement('div') as unknown as Element,
                event = new TouchEvent('touchmove', { cancelable: true });

            container.appendChild(element as unknown as Node);
            onactive(element, 'touchmove', (e: Event) => { e.preventDefault(); });

            element.dispatchEvent(pointer('pointerdown', 'touch'));
            element.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(true);
        });

        it('ignores a mouse press', () => {
            let calls = 0,
                element = document.createElement('div') as unknown as Element;

            container.appendChild(element as unknown as Node);
            onactive(element, 'touchmove', () => { calls++; });

            element.dispatchEvent(pointer('pointerdown', 'mouse'));
            element.dispatchEvent(new TouchEvent('touchmove'));

            expect(calls).toBe(0);
        });

        it('binds for a press on a descendant', () => {
            let calls = 0,
                child = document.createElement('span'),
                element = document.createElement('div') as unknown as Element;

            (element as unknown as Node).appendChild(child);
            container.appendChild(element as unknown as Node);
            onactive(element, 'touchmove', () => { calls++; });

            child.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'touch' }));
            child.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));

            expect(calls).toBe(1);
        });

        it('covers touchstart from the press before it', () => {
            let calls = 0,
                element = document.createElement('div') as unknown as Element;

            container.appendChild(element as unknown as Node);
            onactive(element, 'touchstart', () => { calls++; });

            element.dispatchEvent(pointer('pointerdown', 'touch'));
            element.dispatchEvent(new TouchEvent('touchstart'));

            expect(calls).toBe(1);
        });
    });

    describe('wheel', () => {
        it('listens while the pointer is over the element', () => {
            let calls = 0,
                element = document.createElement('div') as unknown as Element;

            container.appendChild(element as unknown as Node);
            onactive(element, 'wheel', () => { calls++; });

            element.dispatchEvent(new WheelEvent('wheel'));
            expect(calls).toBe(0);

            element.dispatchEvent(pointer('pointermove', 'mouse'));
            element.dispatchEvent(new WheelEvent('wheel'));
            expect(calls).toBe(1);

            element.dispatchEvent(pointer('pointerleave', 'mouse'));
            element.dispatchEvent(new WheelEvent('wheel'));
            expect(calls).toBe(1);
        });
    });

    it('binds an event without a gesture for as long as the element lives', () => {
        let calls = 0,
            element = document.createElement('div') as unknown as Element;

        container.appendChild(element as unknown as Node);
        onactive(element, 'mousewheel', () => { calls++; });

        element.dispatchEvent(new Event('mousewheel'));

        expect(calls).toBe(1);
    });

    it('removes everything when the element is cleaned up', () => {
        let calls = 0,
            element = document.createElement('div') as unknown as Element;

        container.appendChild(element as unknown as Node);
        onactive(element, 'touchmove', () => { calls++; });

        element.dispatchEvent(pointer('pointerdown', 'touch'));
        remove([{ head: element as unknown as Element, tail: element as unknown as Element }]);
        element.dispatchEvent(new TouchEvent('touchmove'));
        element.dispatchEvent(pointer('pointerdown', 'touch'));
        element.dispatchEvent(new TouchEvent('touchmove'));

        expect(calls).toBe(0);
    });
});
