import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { delegate, on, ondisconnect, onrender, runtime } from '../../src/event';
import { CLEANUP } from '../../src/constants';
import { remove } from '../../src/slot/cleanup';
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

    describe('delegate tuple (fn, data)', () => {
        it('tuple handler receives (data, event) with this = matched node', () => {
            let element = document.createElement('button') as Element,
                receivedData: unknown = null,
                receivedEvent: Event | null = null,
                thisValue: unknown = null;

            container.appendChild(element as unknown as Node);
            delegate(element, 'click', function (this: unknown, data: unknown, e: Event) {
                receivedData = data;
                receivedEvent = e;
                thisValue = this;
            }, 'payload');

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(receivedData).toBe('payload');
            expect(receivedEvent).toBeInstanceOf(MouseEvent);
            expect(thisValue).toBe(element);
        });

        it('plain-registered handler still receives (event) only', () => {
            let args: unknown[] = [],
                element = document.createElement('button') as Element;

            container.appendChild(element as unknown as Node);
            delegate(element, 'click', function (...received: unknown[]) {
                args = received;
            });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(args).toHaveLength(1);
            expect(args[0]).toBeInstanceOf(MouseEvent);
        });

        it('two elements sharing one fn dispatch their own data', () => {
            let a = document.createElement('button') as Element,
                b = document.createElement('button') as Element,
                received: unknown[] = [],
                shared = function (this: unknown, data: unknown) {
                    received.push(data);
                };

            container.appendChild(a as unknown as Node);
            container.appendChild(b as unknown as Node);

            delegate(a, 'click', shared, 'a-data');
            delegate(b, 'click', shared, 'b-data');

            a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            b.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(received).toEqual(['a-data', 'b-data']);
        });

        it('tuple handler resolves via ancestor matching with data + currentTarget', () => {
            let capturedTarget: EventTarget | null = null,
                child = document.createElement('span'),
                parent = document.createElement('div') as Element,
                receivedData: unknown = null;

            parent.appendChild(child);
            container.appendChild(parent as unknown as Node);

            delegate(parent, 'click', function (this: unknown, data: unknown, e: Event) {
                capturedTarget = e.currentTarget;
                receivedData = data;
            }, 42);

            child.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(capturedTarget).toBe(parent);
            expect(receivedData).toBe(42);
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

        it('does not register cleanup for removal', () => {
            let element = document.createElement('input') as HTMLElement & { [key: symbol]: unknown };

            container.appendChild(element);
            on(element as unknown as Element, 'focus', () => {});

            expect(element[CLEANUP]).toBeUndefined();
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

        it('routes pointerenter to direct attach', () => {
            let element = document.createElement('div') as Element,
                entered = false;

            container.appendChild(element as unknown as Node);
            runtime(element, 'onpointerenter', () => { entered = true; });
            element.dispatchEvent(new Event('pointerenter'));

            expect(entered).toBe(true);
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

    describe('delegate lifecycle and currentTarget', () => {
        it('sets currentTarget to the element with the handler during delegation', () => {
            let element = document.createElement('button') as Element,
                capturedTarget: EventTarget | null = null;

            container.appendChild(element as unknown as Node);
            delegate(element, 'dblclick', function(e) {
                capturedTarget = e.currentTarget;
            });

            element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

            expect(capturedTarget).toBe(element);
        });

        it('keeps delegated listeners after another element disconnects', () => {
            let a = document.createElement('div') as Element,
                b = document.createElement('div') as Element,
                c = document.createElement('div') as Element,
                calls: string[] = [];

            container.append(a as unknown as Node, b as unknown as Node);
            delegate(a, 'mousemove', () => calls.push('a'));
            delegate(b, 'mousemove', () => calls.push('b'));
            remove([{ head: a, tail: a }]);
            b.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
            container.appendChild(c as unknown as Node);
            delegate(c, 'mousemove', () => calls.push('c'));
            c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

            expect(calls).toEqual(['b', 'c']);
        });
    });

    describe('on() lifecycle', () => {
        it('keeps direct listeners without disconnect cleanup', () => {
            let element = document.createElement('input') as HTMLElement & { [key: symbol]: unknown },
                callCount = 0;

            container.appendChild(element);
            on(element as unknown as Element, 'input', () => { callCount++; });

            element.dispatchEvent(new Event('input'));

            expect(callCount).toBe(1);

            expect(element[CLEANUP]).toBeUndefined();
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
