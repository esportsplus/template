import { afterEach, describe, expect, it, vi } from 'vitest';
import { delegate, on, ondocument, onwindow, runtime } from '../../src/event';
import { setProperties } from '../../src/attributes';
import { remove } from '../../src/slot/cleanup';
import type { Attributes, Element } from '../../src/types';


type Mode = 'delegate' | 'direct' | 'document' | 'window';


const attach = { delegate, direct: on, document: ondocument, window: onwindow };

const target = (mode: Mode, element: Element) => mode === 'document' ? document.body : mode === 'window' ? window : element;


describe('event hosts', () => {
    let owners: Element[] = [];

    function owner() {
        let element = document.createElement('button') as Element;

        document.body.append(element);
        owners.push(element);

        return element;
    }

    afterEach(() => {
        for (let i = 0, n = owners.length; i < n; i++) {
            remove([{ head: owners[i] }]);
        }

        owners = [];
        vi.restoreAllMocks();
    });

    describe('once', () => {
        it.each<Mode>(['delegate', 'direct', 'document', 'window'])('%s once binding fires a single time and is released by cleanup', mode => {
            let count = 0,
                element = owner(),
                trigger = () => target(mode, element).dispatchEvent(new MouseEvent('click', { bubbles: true }));

            attach[mode](element, 'click', () => { count++; }, true);

            trigger();
            trigger();

            expect(count).toBe(1);

            remove([{ head: element }]);
            trigger();

            expect(count).toBe(1);
        });

        it('removes a once binding before invoking it', () => {
            let element = owner(),
                nested = 0;

            ondocument(element, 'keydown', () => {
                document.dispatchEvent(new KeyboardEvent('keydown'));
                nested++;
            }, true);

            document.dispatchEvent(new KeyboardEvent('keydown'));

            expect(nested).toBe(1);
        });
    });

    describe('replacement', () => {
        it.each<Mode>(['delegate', 'direct', 'document', 'window'])('%s rebinding replaces the previous handler', mode => {
            let element = owner(),
                first = vi.fn(),
                next = vi.fn(),
                trigger = () => target(mode, element).dispatchEvent(new MouseEvent('click', { bubbles: true }));

            attach[mode](element, 'click', first);
            trigger();

            attach[mode](element, 'click', next);
            trigger();

            expect(first).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('delegated cleanup keeps the host listener alive for other owners', () => {
            let a = owner(),
                b = owner(),
                first = vi.fn(),
                second = vi.fn();

            delegate(a, 'click', first);
            delegate(b, 'click', second);

            remove([{ head: a }]);
            owners.shift();

            a.click();
            b.click();

            expect(first).not.toHaveBeenCalled();
            expect(second).toHaveBeenCalledTimes(1);
        });
    });

    describe('name routing', () => {
        it.each([
            ['onclick', document, 'click', 1],
            ['onceclick', document, 'click', 1],
            ['ondocumentkeydown', document, 'keydown', 1],
            ['oncedocumentkeydown', document, 'keydown', 1],
            ['onwindowresize', window, 'resize', 1],
            ['oncewindowload', window, 'load', 1],
            ['ondomcontentloaded', document, 'domcontentloaded', 1],
            ['ondurationchange', null, 'durationchange', 1],
            ['onwheel', document, 'wheel', 1],
            ['oncancel', null, 'cancel', 1]
        ])('routes %s to the right host and event', (name, host, event, count) => {
            let element = owner(),
                spies = [document, window, element].map(t => vi.spyOn(t, 'addEventListener')),
                registered = (t: EventTarget) => spies[[document, window, element].indexOf(t)].mock.calls.filter(([n]) => n === event).length;

            runtime(element, name as `on${string}`, () => {});

            expect(registered(host || element)).toBe(count);
        });
    });

    describe('document and window bindings', () => {
        it('supports runtime property objects without treating callbacks as effects', () => {
            let element = owner(),
                handler = vi.fn(),
                properties: Attributes = { ondocumentkeydown: handler, onwindowresize: handler };

            setProperties(element, properties);

            expect(handler).not.toHaveBeenCalled();

            document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'k' }));
            window.dispatchEvent(new Event('resize'));

            expect(handler).toHaveBeenCalledTimes(2);
            expect(element.hasAttribute('ondocumentkeydown')).toBe(false);
            expect(element.hasAttribute('onwindowresize')).toBe(false);

            remove([{ head: element }]);
            owners.shift();
            document.dispatchEvent(new KeyboardEvent('keydown'));
            window.dispatchEvent(new Event('resize'));

            expect(handler).toHaveBeenCalledTimes(2);
        });

        it('shares one host listener and removes it only after the last owner', () => {
            let a = owner(),
                b = owner(),
                add = vi.spyOn(window, 'addEventListener'),
                detach = vi.spyOn(window, 'removeEventListener'),
                first = vi.fn(),
                second = vi.fn(),
                resizes = (spy: typeof add) => spy.mock.calls.filter(([name]) => name === 'resize').length;

            runtime(a, 'onWindowResize', first);
            runtime(b, 'onwindowresize', second);

            expect(resizes(add)).toBe(1);

            window.dispatchEvent(new Event('resize'));

            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(1);

            remove([{ head: a }]);
            owners.shift();

            expect(resizes(detach)).toBe(0);

            window.dispatchEvent(new Event('resize'));

            expect(second).toHaveBeenCalledTimes(2);

            remove([{ head: b }]);
            owners.shift();

            expect(resizes(detach)).toBe(1);
        });

        it('passes the host as this and restores currentTarget after delegated dispatch', () => {
            let element = owner(),
                targets: unknown[] = [];

            delegate(element, 'click', event => { targets.push(event.currentTarget); });
            ondocument(element, 'click', function (event) {
                targets.push(event.currentTarget, this);
            });

            element.click();

            expect(targets).toEqual([element, document, document]);
        });

        it('does not skip another handler when a once handler removes itself', () => {
            let a = owner(),
                b = owner(),
                calls: string[] = [];

            ondocument(a, 'keydown', () => { calls.push('a'); }, true);
            ondocument(b, 'keydown', () => { calls.push('b'); });

            document.dispatchEvent(new KeyboardEvent('keydown'));
            document.dispatchEvent(new KeyboardEvent('keydown'));

            expect(calls).toEqual(['a', 'b', 'b']);
        });

        it('continues other handlers after a handler throws', () => {
            let a = owner(),
                b = owner(),
                errors: unknown[] = [],
                failure = new Error('handler failed'),
                report = (event: ErrorEvent) => {
                    errors.push(event.error);
                    event.preventDefault();
                },
                second = vi.fn();

            window.addEventListener('error', report);

            try {
                ondocument(a, 'keydown', () => { throw failure; });
                ondocument(b, 'keydown', second);

                document.dispatchEvent(new KeyboardEvent('keydown'));

                expect(second).toHaveBeenCalledTimes(1);
                expect(errors).toEqual([failure]);
            }
            finally {
                window.removeEventListener('error', report);
            }
        });
    });
});
