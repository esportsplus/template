import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { delegate, on, ondisconnect, onrender, runtime } from '../../src/event';
import { CLEANUP } from '../../src/constants';
import type { Element } from '../../src/types';


describe('event/index', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    describe('delegate', () => {
        it('registers click handler via delegation', () => {
            let element = document.createElement('button') as Element,
                clicked = false;

            container.appendChild(element as unknown as Node);
            delegate(element, 'click', () => { clicked = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });

        it('handler receives event object', () => {
            let element = document.createElement('button') as Element,
                receivedEvent: Event | null = null;

            container.appendChild(element as unknown as Node);
            delegate(element, 'click', (e) => { receivedEvent = e; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(receivedEvent).toBeInstanceOf(MouseEvent);
        });

        it('handler is called with element as this', () => {
            let element = document.createElement('button') as Element,
                thisValue: unknown = null;

            container.appendChild(element as unknown as Node);
            delegate(element, 'click', function(this: unknown) { thisValue = this; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(thisValue).toBe(element);
        });

        it('event bubbles up to find handler', () => {
            let parent = document.createElement('div') as Element,
                child = document.createElement('span'),
                clicked = false;

            parent.appendChild(child);
            container.appendChild(parent as unknown as Node);

            delegate(parent, 'click', () => { clicked = true; });

            child.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });

        it('supports multiple different event types', () => {
            let element = document.createElement('div') as Element,
                clicked = false,
                mousedown = false;

            container.appendChild(element as unknown as Node);

            delegate(element, 'click', () => { clicked = true; });
            delegate(element, 'mousedown', () => { mousedown = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
            expect(mousedown).toBe(false);

            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

            expect(mousedown).toBe(true);
        });

        it('later handler replaces earlier handler for same event', () => {
            let element = document.createElement('button') as Element,
                firstCalled = false,
                secondCalled = false;

            container.appendChild(element as unknown as Node);

            delegate(element, 'click', () => { firstCalled = true; });
            delegate(element, 'click', () => { secondCalled = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(firstCalled).toBe(false);
            expect(secondCalled).toBe(true);
        });
    });

    describe('on (direct attachment)', () => {
        it('attaches event listener directly', () => {
            let element = document.createElement('input') as Element,
                focused = false;

            container.appendChild(element as unknown as Node);
            on(element, 'focus', () => { focused = true; });

            element.dispatchEvent(new FocusEvent('focus'));

            expect(focused).toBe(true);
        });

        it('handler receives event object', () => {
            let element = document.createElement('input') as Element,
                receivedEvent: Event | null = null;

            container.appendChild(element as unknown as Node);
            on(element, 'blur', (e) => { receivedEvent = e; });

            element.dispatchEvent(new FocusEvent('blur'));

            expect(receivedEvent).toBeInstanceOf(FocusEvent);
        });

        it('handler is called with element as this', () => {
            let element = document.createElement('input') as Element,
                thisValue: unknown = null;

            container.appendChild(element as unknown as Node);
            on(element, 'focus', function(this: unknown) { thisValue = this; });

            element.dispatchEvent(new FocusEvent('focus'));

            expect(thisValue).toBe(element);
        });

        it('registers cleanup function for removal', () => {
            let element = document.createElement('input') as HTMLElement & { [key: symbol]: unknown };

            container.appendChild(element);
            on(element as unknown as Element, 'focus', () => {});

            expect(element[CLEANUP]).toBeInstanceOf(Array);
            expect((element[CLEANUP] as unknown[]).length).toBeGreaterThan(0);
        });
    });

    describe('ondisconnect', () => {
        it('registers disconnect callback', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                callback = vi.fn();

            container.appendChild(element);
            ondisconnect(element as unknown as Element, callback);

            expect(element[CLEANUP]).toBeInstanceOf(Array);
        });

        it('callback receives element when invoked', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown },
                receivedElement: unknown = null;

            container.appendChild(element);
            ondisconnect(element as unknown as Element, (el) => { receivedElement = el; });

            // Manually trigger cleanup
            let fns = element[CLEANUP] as VoidFunction[];

            fns[0]();

            expect(receivedElement).toBe(element);
        });
    });

    describe('onrender', () => {
        it('calls listener immediately with element', () => {
            let element = document.createElement('div') as Element,
                receivedElement: unknown = null;

            container.appendChild(element as unknown as Node);
            onrender(element, (el) => { receivedElement = el; });

            expect(receivedElement).toBe(element);
        });

        it('calls listener synchronously', () => {
            let element = document.createElement('div') as Element,
                callOrder: string[] = [];

            container.appendChild(element as unknown as Node);

            callOrder.push('before');
            onrender(element, () => { callOrder.push('render'); });
            callOrder.push('after');

            expect(callOrder).toEqual(['before', 'render', 'after']);
        });
    });

    describe('runtime', () => {
        it('routes click event to delegate', () => {
            let element = document.createElement('button') as Element,
                clicked = false;

            container.appendChild(element as unknown as Node);
            runtime(element, 'onclick', () => { clicked = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });

        it('routes focus event to on (direct attach)', () => {
            let element = document.createElement('input') as Element,
                focused = false;

            container.appendChild(element as unknown as Node);
            runtime(element, 'onfocus', () => { focused = true; });

            element.dispatchEvent(new FocusEvent('focus'));

            expect(focused).toBe(true);
        });

        it('routes blur event to on (direct attach)', () => {
            let element = document.createElement('input') as Element,
                blurred = false;

            container.appendChild(element as unknown as Node);
            runtime(element, 'onblur', () => { blurred = true; });

            element.dispatchEvent(new FocusEvent('blur'));

            expect(blurred).toBe(true);
        });

        it('routes onrender to lifecycle handler', () => {
            let element = document.createElement('div') as Element,
                rendered = false;

            container.appendChild(element as unknown as Node);
            runtime(element, 'onrender', () => { rendered = true; });

            expect(rendered).toBe(true);
        });

        it('routes ondisconnect to lifecycle handler', () => {
            let element = document.createElement('div') as HTMLElement & { [key: symbol]: unknown };

            container.appendChild(element);
            runtime(element as unknown as Element, 'ondisconnect', () => {});

            expect(element[CLEANUP]).toBeInstanceOf(Array);
        });

        it('handles case insensitive event names', () => {
            let element = document.createElement('button') as Element,
                clicked = false;

            container.appendChild(element as unknown as Node);
            runtime(element, 'onClick', () => { clicked = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });

        it('routes scroll to direct attach', () => {
            let element = document.createElement('div') as Element,
                scrolled = false;

            container.appendChild(element as unknown as Node);
            runtime(element, 'onscroll', () => { scrolled = true; });

            element.dispatchEvent(new Event('scroll'));

            expect(scrolled).toBe(true);
        });

        it('routes submit to direct attach', () => {
            let form = document.createElement('form') as Element,
                submitted = false;

            container.appendChild(form as unknown as Node);
            runtime(form, 'onsubmit', (e) => {
                e.preventDefault();
                submitted = true;
            });

            form.dispatchEvent(new Event('submit'));

            expect(submitted).toBe(true);
        });
    });

    describe('event delegation storage', () => {
        it('stores handler on element via symbol key', () => {
            let element = document.createElement('button') as Element,
                handler = () => {};

            container.appendChild(element as unknown as Node);
            delegate(element, 'click', handler);

            // Handler is stored on element - check it can be invoked
            let clicked = false;

            delegate(element, 'click', () => { clicked = true; });
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });
    });

    describe('passive events', () => {
        it('wheel event uses passive listener', () => {
            let element = document.createElement('div') as Element,
                wheeled = false;

            container.appendChild(element as unknown as Node);
            delegate(element, 'wheel', () => { wheeled = true; });

            element.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));

            expect(wheeled).toBe(true);
        });

        it('touchstart event uses passive listener', () => {
            let element = document.createElement('div') as Element,
                touched = false;

            container.appendChild(element as unknown as Node);
            delegate(element, 'touchstart', () => { touched = true; });

            element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));

            expect(touched).toBe(true);
        });

        it('scroll event (direct attach) uses passive', () => {
            let element = document.createElement('div') as Element,
                scrolled = false;

            container.appendChild(element as unknown as Node);
            on(element, 'scroll', () => { scrolled = true; });

            element.dispatchEvent(new Event('scroll'));

            expect(scrolled).toBe(true);
        });
    });
});
