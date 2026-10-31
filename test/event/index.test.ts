import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { delegate, direct, ondisconnect, runtime } from '../../src/event';
import { root } from '@esportsplus/reactivity';
import { CLEANUP } from '../../src/constants';
import type { Element } from '../../src/types';


function create(tag: string) {
    return document.createElement(tag) as unknown as Element;
}


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
            let element = create('button'),
                clicked = false;

            container.appendChild(element);
            delegate(element, 'click', () => { clicked = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });

        it('handler receives event object', () => {
            let element = create('button'),
                receivedEvent: Event | null = null;

            container.appendChild(element);
            delegate(element, 'click', (e: Event) => { receivedEvent = e; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(receivedEvent).toBeInstanceOf(MouseEvent);
        });

        it('handler is called with element as this', () => {
            let element = create('button'),
                thisValue: unknown = null;

            container.appendChild(element);
            delegate(element, 'click', function(this: unknown) { thisValue = this; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(thisValue).toBe(element);
        });

        it('event bubbles up to find handler', () => {
            let parent = create('div'),
                child = document.createElement('span'),
                clicked = false;

            parent.appendChild(child);
            container.appendChild(parent);

            delegate(parent, 'click', () => { clicked = true; });

            child.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });

        it('supports multiple different event types', () => {
            let element = create('div'),
                clicked = false,
                mousedown = false;

            container.appendChild(element);

            delegate(element, 'click', () => { clicked = true; });
            delegate(element, 'mousedown', () => { mousedown = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
            expect(mousedown).toBe(false);

            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

            expect(mousedown).toBe(true);
        });

        it('later handler replaces earlier handler for same event', () => {
            let element = create('button'),
                firstCalled = false,
                secondCalled = false;

            container.appendChild(element);

            delegate(element, 'click', () => { firstCalled = true; });
            delegate(element, 'click', () => { secondCalled = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(firstCalled).toBe(false);
            expect(secondCalled).toBe(true);
        });
    });

    describe('delegate arguments', () => {
        it('handler receives (event, dispose)', () => {
            let args: unknown[] = [],
                element = create('button');

            container.appendChild(element);
            delegate(element, 'click', function (...received: unknown[]) {
                args = received;
            });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(args).toHaveLength(2);
            expect(args[0]).toBeInstanceOf(MouseEvent);
            expect(args[1]).toBeTypeOf('function');
        });

        it('ancestor match sets currentTarget to the bound element', () => {
            let capturedTarget: EventTarget | null = null,
                child = document.createElement('span'),
                parent = create('div');

            parent.appendChild(child);
            container.appendChild(parent);

            delegate(parent, 'click', function (e: Event) {
                capturedTarget = e.currentTarget;
            });

            child.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(capturedTarget).toBe(parent);
        });
    });

    describe('direct', () => {
        it('attaches event listener directly', () => {
            let element = create('input'),
                focused = false;

            container.appendChild(element);
            direct(element, 'focus', () => { focused = true; });

            element.dispatchEvent(new FocusEvent('focus'));

            expect(focused).toBe(true);
        });

        it('handler receives event object', () => {
            let element = create('input'),
                receivedEvent: Event | null = null;

            container.appendChild(element);
            direct(element, 'blur', (e: Event) => { receivedEvent = e; });

            element.dispatchEvent(new FocusEvent('blur'));

            expect(receivedEvent).toBeInstanceOf(FocusEvent);
        });

        it('handler is called with element as this', () => {
            let element = create('input'),
                thisValue: unknown = null;

            container.appendChild(element);
            direct(element, 'focus', function(this: unknown) { thisValue = this; });

            element.dispatchEvent(new FocusEvent('focus'));

            expect(thisValue).toBe(element);
        });

        it('registers cleanup to remove the listener', () => {
            let element = create('input'),
                focused = false;

            container.appendChild(element);

            let dispose = root((d) => {
                    direct(element, 'focus', () => { focused = true; });
                    return d;
                });

            dispose();
            element.dispatchEvent(new FocusEvent('focus'));

            expect(focused).toBe(false);
        });
    });

    describe('ondisconnect', () => {
        it('registers disconnect callback', () => {
            let element = create('div'),
                callback = vi.fn();

            container.appendChild(element);
            ondisconnect(element, callback);

            expect(element[CLEANUP]).toBeInstanceOf(Array);
        });

        it('callback receives element when invoked', () => {
            let element = create('div'),
                receivedElement: unknown = null;

            container.appendChild(element);
            ondisconnect(element, (el) => { receivedElement = el; });

            // Manually trigger cleanup
            let fns = element[CLEANUP] as VoidFunction[];

            fns[0]();

            expect(receivedElement).toBe(element);
        });
    });

    describe('runtime', () => {
        it('routes click to delegation', () => {
            let element = create('button'),
                clicked = false;

            container.appendChild(element);
            runtime(element, 'onclick', () => { clicked = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });

        it('routes focus to direct attachment', () => {
            let element = create('input'),
                focused = false;

            container.appendChild(element);
            runtime(element, 'onfocus', () => { focused = true; });

            element.dispatchEvent(new FocusEvent('focus'));

            expect(focused).toBe(true);
        });

        it('routes blur to direct attachment', () => {
            let element = create('input'),
                blurred = false;

            container.appendChild(element);
            runtime(element, 'onblur', () => { blurred = true; });

            element.dispatchEvent(new FocusEvent('blur'));

            expect(blurred).toBe(true);
        });

        it('routes onfirstpaint to lifecycle handler', () => {
            let element = create('div');

            container.appendChild(element);
            runtime(element, 'onfirstpaint', () => {});

            // Waiting for its frame, it registers a cleanup that stops the wait on disposal.
            expect(element[CLEANUP]).toBeInstanceOf(Array);
        });

        it('routes ondisconnect to lifecycle handler', () => {
            let element = create('div');

            container.appendChild(element);
            runtime(element, 'ondisconnect', () => {});

            expect(element[CLEANUP]).toBeInstanceOf(Array);
        });

        it('handles case insensitive event names', () => {
            let element = create('button'),
                clicked = false;

            container.appendChild(element);
            runtime(element, 'onClick', () => { clicked = true; });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });

        it('routes scroll to direct attach', () => {
            let element = create('div'),
                scrolled = false;

            container.appendChild(element);
            runtime(element, 'onscroll', () => { scrolled = true; });

            element.dispatchEvent(new Event('scroll'));

            expect(scrolled).toBe(true);
        });

        it('routes submit to direct attach', () => {
            let form = create('form'),
                submitted = false;

            container.appendChild(form);
            runtime(form, 'onsubmit', (e) => {
                e.preventDefault();
                submitted = true;
            });

            form.dispatchEvent(new Event('submit'));

            expect(submitted).toBe(true);
        });

        it('routes pointerenter to direct attach', () => {
            let element = create('div'),
                entered = false;

            container.appendChild(element);
            runtime(element, 'onpointerenter', () => { entered = true; });
            element.dispatchEvent(new Event('pointerenter'));

            expect(entered).toBe(true);
        });
    });

    describe('event delegation storage', () => {
        it('stores handler on element via symbol key', () => {
            let element = create('button'),
                handler = () => {};

            container.appendChild(element);
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
            let element = create('button'),
                capturedTarget: EventTarget | null = null;

            container.appendChild(element);
            delegate(element, 'dblclick', function(e: Event) {
                capturedTarget = e.currentTarget;
            });

            element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

            expect(capturedTarget).toBe(element);
        });

        it('keeps delegated listeners after another element disconnects', () => {
            let a = create('div'),
                b = create('div'),
                c = create('div'),
                calls: string[] = [];

            container.append(a, b);

            let dispose = root((d) => {
                    delegate(a, 'mousemove', () => calls.push('a'));
                    return d;
                });

            delegate(b, 'mousemove', () => calls.push('b'));
            dispose();
            a.remove();
            b.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
            container.appendChild(c);
            delegate(c, 'mousemove', () => calls.push('c'));
            c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

            expect(calls).toEqual(['b', 'c']);
        });
    });

    describe('direct lifecycle', () => {
        it('registers direct listeners with disconnect cleanup', () => {
            let element = create('input'),
                callCount = 0;

            container.appendChild(element);
            direct(element, 'focus', () => { callCount++; });

            element.dispatchEvent(new FocusEvent('focus'));

            expect(callCount).toBe(1);

            expect(element[CLEANUP]).toBeInstanceOf(Array);
        });
    });

    describe('passive events', () => {
        it('registers touch and wheel listeners passive, so they cannot cancel', () => {
            for (let event of [
                new TouchEvent('touchmove', { bubbles: true, cancelable: true }),
                new TouchEvent('touchstart', { bubbles: true, cancelable: true }),
                new WheelEvent('wheel', { bubbles: true, cancelable: true })
            ]) {
                let element = create('div'),
                    called = false;

                container.appendChild(element);
                delegate(element, event.type, (e: Event) => {
                    called = true;
                    e.preventDefault();
                });

                element.dispatchEvent(event);

                expect(called).toBe(true);
                expect(event.defaultPrevented).toBe(false);
            }
        });

        it('lets every other event cancel', () => {
            let element = create('div'),
                event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

            container.appendChild(element);
            delegate(element, 'mousedown', (e: Event) => { e.preventDefault(); });

            element.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(true);
        });

        it('scroll event attaches directly', () => {
            let element = create('div'),
                scrolled = false;

            container.appendChild(element);
            direct(element, 'scroll', () => { scrolled = true; });

            element.dispatchEvent(new Event('scroll'));

            expect(scrolled).toBe(true);
        });
    });
});
