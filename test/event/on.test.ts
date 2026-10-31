import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stripTypeScriptTypes } from 'node:module';
import { read, root, signal, write } from '@esportsplus/reactivity';
import { languageService } from '@esportsplus/typescript/compiler';
import { CLEANUP } from '../../src/constants';
import { generateCode } from '../../src/compiler/codegen';
import { NAMESPACE } from '../../src/compiler/constants';
import { findTemplateArtifacts } from '../../src/compiler/ts-parser';
import type { Element, EventOptions, On } from '../../src/types';


let callbacks: VoidFunction[] = [];

vi.mock('../../src/utilities', async (importOriginal) => {
    let original = await importOriginal<typeof import('../../src/utilities')>();

    return {
        ...original,
        raf: (cb: VoidFunction) => { callbacks.push(cb); }
    };
});


let { setProperties } = await import('../../src/attributes'),
    { delegate, on, onconnect, runtime } = await import('../../src/event'),
    namespace = await import('../../src');


const tick = () => Promise.resolve();


function frame() {
    let current = callbacks;

    callbacks = [];

    for (let i = 0, n = current.length; i < n; i++) {
        current[i]();
    }
}

// Lowers 'source' and runs it against the runtime this file mocks; 'value' is what it returns
function compile(source: string, args: Record<string, unknown>) {
    let { sourceFile } = languageService.scratch(process.cwd() + '/on-fixture.ts', source),
        result = generateCode(findTemplateArtifacts(sourceFile), sourceFile),
        output = source;

    for (let replacement of [...result.replacements].sort((a, b) => b.node.getStart(sourceFile) - a.node.getStart(sourceFile))) {
        output = output.slice(0, replacement.node.getStart(sourceFile)) + replacement.generate(sourceFile) + output.slice(replacement.node.end);
    }

    return new Function(NAMESPACE, ...Object.keys(args), stripTypeScriptTypes(result.prepend.join('\n') + '\n' + output) + '\nreturn value;')(namespace, ...Object.values(args));
}

// How many of the spied calls were for 'event'
function registered(spy: { mock: { calls: unknown[][] } }, event: string) {
    return spy.mock.calls.filter(([name]) => name === event).length;
}


describe('event/on', () => {
    let container: HTMLElement,
        disposers: VoidFunction[] = [];

    function element(tag = 'div', parent: Node = container) {
        let node = document.createElement(tag);

        parent.appendChild(node);

        return node as unknown as Element & HTMLElement;
    }

    function track(dispose: VoidFunction) {
        disposers.push(dispose);

        return dispose;
    }

    beforeEach(() => {
        callbacks = [];
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        for (let i = 0, n = disposers.length; i < n; i++) {
            disposers[i]();
        }

        // Drains onconnect's frame loop so it resets between tests
        for (let i = 0; i < 65; i++) {
            frame();
        }

        disposers = [];
        container.remove();
        vi.restoreAllMocks();
    });

    describe('targets', () => {
        it('an element: delegated, called with the element, the event and a disposer', () => {
            let args: unknown[] = [],
                node = element('button'),
                self: unknown = null;

            track(on(node, 'click', function (...received) {
                args = received;
                self = this;
            }));

            node.click();

            expect(self).toBe(node);
            expect(args).toHaveLength(2);
            expect(args[0]).toBeInstanceOf(MouseEvent);
            expect(args[1]).toBeTypeOf('function');
        });

        it('document and window, called with the target', () => {
            let selves: unknown[] = [];

            track(on(document, 'keydown', function () { selves.push(this); }));
            track(on(window, 'resize', function () { selves.push(this); }));

            document.dispatchEvent(new KeyboardEvent('keydown'));
            window.dispatchEvent(new Event('resize'));

            expect(selves).toEqual([document, window]);
        });

        it('any EventTarget', () => {
            let calls = 0,
                target = new EventTarget();

            track(on(target, 'change', () => { calls++; }));
            target.dispatchEvent(new Event('change'));

            expect(calls).toBe(1);
        });

        it('a node that has left the DOM, attached directly', () => {
            let calls = 0,
                node = element();

            track(on(node, 'touchmove', () => { calls++; }, { direct: true, passive: false }));
            node.remove();
            node.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));

            expect(calls).toBe(1);
        });

        it('a delegated binding on a detached node runs once the node is in the document', () => {
            let calls = 0,
                node = document.createElement('div');

            track(on(node, 'click', () => { calls++; }));
            node.click();

            expect(calls).toBe(0);

            container.append(node);
            node.click();

            expect(calls).toBe(1);
        });
    });

    describe('shared native listeners', () => {
        it('one per target, event, capture and passive, removed when the last binding goes', () => {
            let a = element(),
                add = vi.spyOn(document, 'addEventListener'),
                b = element(),
                remove = vi.spyOn(document, 'removeEventListener'),
                disposers = [
                    on(a, 'shared', () => {}),
                    on(b, 'shared', () => {}),
                    on(document, 'shared', () => {}),
                    on(document, 'shared', () => {}, { passive: false }),
                    on(document, 'shared', () => {}, { capture: true }),
                    on(document, 'shared', () => {}, { passive: true }),
                    on(document, 'shared', () => {}, { capture: true, passive: true })
                ];

            // Delegated and document bindings share one; an explicit default passive shares it too
            expect(registered(add, 'shared')).toBe(4);
            expect(add.mock.calls.filter(([name]) => name === 'shared').map(([, , options]) => options)).toEqual([
                { capture: false, passive: false },
                { capture: true, passive: false },
                { capture: false, passive: true },
                { capture: true, passive: true }
            ]);

            disposers[0]();
            disposers[1]();
            disposers[2]();

            expect(registered(remove, 'shared')).toBe(0);

            disposers[3]();

            expect(registered(remove, 'shared')).toBe(1);

            disposers[4]();
            disposers[5]();
            disposers[6]();

            expect(registered(remove, 'shared')).toBe(4);

            track(on(document, 'shared', () => {}));

            expect(registered(add, 'shared')).toBe(5);
        });

        it('keyed per target', () => {
            let a = element(),
                b = element(),
                addA = vi.spyOn(a, 'addEventListener'),
                addB = vi.spyOn(b, 'addEventListener');

            track(on(a, 'focus', () => {}));
            track(on(a, 'focus', () => {}));
            track(on(b, 'focus', () => {}));
            track(on(b, 'click', () => {}, { direct: true }));

            expect(registered(addA, 'focus')).toBe(1);
            expect(registered(addB, 'focus')).toBe(1);
            expect(registered(addB, 'click')).toBe(1);
        });

        it('stacks on() calls, each with its own disposer, beside an attribute binding', () => {
            let order: string[] = [],
                node = element('button'),
                first = track(on(node, 'click', () => { order.push('first'); }));

            track(on(node, 'click', () => { order.push('second'); }));
            delegate(node, 'click', () => { order.push('attribute'); });
            delegate(node, 'click', () => { order.push('replacement'); });

            node.click();

            expect(order).toEqual(['first', 'second', 'replacement']);

            first();
            order = [];
            node.click();

            expect(order).toEqual(['second', 'replacement']);
        });

        it('runs every binding when one throws, and rethrows its error', () => {
            let errors: unknown[] = [],
                failure = new Error('failed'),
                node = element('button'),
                report = (event: ErrorEvent) => {
                    errors.push(event.error);
                    event.preventDefault();
                },
                second = vi.fn();

            window.addEventListener('error', report);

            try {
                track(on(node, 'click', () => { throw failure; }));
                track(on(node, 'click', second));
                node.click();

                expect(second).toHaveBeenCalledTimes(1);
                expect(errors).toEqual([failure]);
            }
            finally {
                window.removeEventListener('error', report);
            }
        });
    });

    describe('capture', () => {
        it('runs before bubble listeners and never replaces or is replaced by them', () => {
            let child = element('span'),
                order: string[] = [],
                parent = element();

            parent.appendChild(child);

            track(on(parent, 'click', () => { order.push('parent capture'); }, { capture: true }));
            track(on(child, 'click', () => { order.push('child bubble'); }));
            track(on(child, 'click', () => { order.push('child capture'); }, { capture: true }));
            delegate(child, 'click', () => { order.push('child attribute'); });

            child.click();

            expect(order).toEqual(['parent capture', 'child capture', 'child bubble', 'child attribute']);
        });

        it('attaches to the element: capture implies direct', () => {
            let add = vi.spyOn(document, 'addEventListener'),
                node = element(),
                own = vi.spyOn(node, 'addEventListener');

            track(on(node, 'capturetest', () => {}, { capture: true }));

            expect(registered(add, 'capturetest')).toBe(0);
            expect(registered(own, 'capturetest')).toBe(1);
        });
    });

    describe('direct', () => {
        it('reaches the element past nested bound content', () => {
            let calls: string[] = [],
                child = element('button'),
                parent = element();

            parent.appendChild(child);
            delegate(child, 'click', () => { calls.push('child'); });
            track(on(parent, 'click', () => { calls.push('delegated'); }));
            track(on(parent, 'click', () => { calls.push('direct'); }, { direct: true }));

            child.click();

            // Delegation stops at the nearest bound element
            expect(calls).toEqual(['direct', 'child']);
        });
    });

    describe('passive', () => {
        it.each([
            ['touchmove', () => new TouchEvent('touchmove', { bubbles: true, cancelable: true })],
            ['wheel', () => new WheelEvent('wheel', { bubbles: true, cancelable: true })]
        ] as const)('passive: false lets preventDefault work on %s, delegated or direct', (type, create) => {
            for (let options of [undefined, { passive: false }, { direct: true, passive: false }]) {
                let event = create(),
                    node = element();

                track(on(node, type, (e: Event) => { e.preventDefault(); }, options));
                node.dispatchEvent(event);

                expect(event.defaultPrevented).toBe(options !== undefined);
            }
        });
    });

    describe('ending a binding', () => {
        it('once, the disposer, the dispose argument and signal each remove only their own binding', () => {
            let controller = new AbortController(),
                counts = { disposer: 0, dispose: 0, kept: 0, once: 0, signal: 0 },
                node = element('button'),
                disposer = on(node, 'click', () => { counts.disposer++; });

            track(on(node, 'click', () => { counts.once++; }, { once: true }));
            track(on(node, 'click', (_e, dispose) => {
                counts.dispose++;
                dispose();
            }));
            track(on(node, 'click', () => { counts.signal++; }, { signal: controller.signal }));
            track(on(node, 'click', () => { counts.kept++; }));

            node.click();
            disposer();
            controller.abort();
            node.click();
            node.click();

            expect(counts).toEqual({ disposer: 1, dispose: 1, kept: 3, once: 1, signal: 1 });
        });

        it.each(['capture', 'delegated', 'direct', 'document', 'passive', 'target', 'window'] as const)('ends a %s binding by once, the disposer, the dispose argument or signal, then its native listener', (kind) => {
            let controller = new AbortController(),
                counts = { disposer: 0, dispose: 0, kept: 0, once: 0, signal: 0 },
                node = element('button'),
                options: EventOptions = kind === 'capture' ? { capture: true } : kind === 'direct' ? { direct: true } : kind === 'passive' ? { passive: true } : {},
                target: EventTarget = kind === 'document' ? document : kind === 'window' ? window : kind === 'target' ? new EventTarget() : node,
                host = kind === 'delegated' || kind === 'passive' ? document : target,
                bind = (listener: (event: Event, dispose: VoidFunction) => void, extra?: EventOptions) =>
                    on(target, 'ending', listener, { ...options, ...extra }),
                fire = () => { target.dispatchEvent(new Event('ending', { bubbles: true })); };

            using remove = vi.spyOn(host, 'removeEventListener');

            let disposer = bind(() => { counts.disposer++; });

            bind(() => { counts.once++; }, { once: true });
            bind((_e, dispose) => {
                counts.dispose++;
                dispose();
            });
            bind(() => { counts.signal++; }, { signal: controller.signal });

            let kept = bind(() => { counts.kept++; });

            fire();
            disposer();
            controller.abort();
            fire();
            fire();

            expect(counts).toEqual({ disposer: 1, dispose: 1, kept: 3, once: 1, signal: 1 });
            expect(registered(remove, 'ending')).toBe(0);

            kept();

            expect(registered(remove, 'ending')).toBe(1);
        });

        it('binds nothing for an already-aborted signal', () => {
            let add = vi.spyOn(document, 'addEventListener'),
                listener = vi.fn(),
                node = element('button'),
                dispose = on(node, 'aborted', listener, { signal: AbortSignal.abort() });

            node.dispatchEvent(new Event('aborted', { bubbles: true }));

            expect(listener).not.toHaveBeenCalled();
            expect(registered(add, 'aborted')).toBe(0);
            expect(dispose).toBeTypeOf('function');

            dispose();
        });

        it.each(['disposer', 'dispose argument', 'once'] as const)('removes the abort listener when released by the %s', route => {
            let controller = new AbortController(),
                add = vi.spyOn(controller.signal, 'addEventListener'),
                node = element('button'),
                remove = vi.spyOn(controller.signal, 'removeEventListener'),
                disposer = on(node, 'click', (_e, dispose) => {
                    if (route === 'dispose argument') {
                        dispose();
                    }
                }, { once: route === 'once', signal: controller.signal });

            expect(registered(add, 'abort')).toBe(1);

            if (route === 'disposer') {
                disposer();
            }
            else {
                node.click();
            }

            expect(registered(remove, 'abort')).toBe(1);
            expect(remove.mock.calls[0][1]).toBe(add.mock.calls[0][1]);
        });

        it('is never removed by the template on its own', () => {
            let calls = 0,
                node = element('button'),
                dispose = root((dispose) => {
                    track(on(node, 'click', () => { calls++; }));
                    track(on(document, 'standalone', () => { calls++; }));

                    return dispose;
                });

            dispose();
            node.remove();
            container.append(node);
            node.click();
            document.dispatchEvent(new Event('standalone'));

            expect(calls).toBe(2);
            expect((node as unknown as Record<symbol, unknown>)[CLEANUP]).toBeUndefined();
        });
    });

    describe('onconnect', () => {
        it('runs once on first connect, untracked, with the element and a bound on', async () => {
            let calls: unknown[][] = [],
                count = signal(0),
                node = document.createElement('div') as unknown as Element & HTMLElement;

            onconnect(node, (...args) => {
                calls.push(args);
                read(count);
            });
            frame();

            expect(calls).toHaveLength(0);

            container.append(node);
            frame();

            expect(calls).toHaveLength(1);
            expect(calls[0][0]).toBe(node);
            expect(calls[0][1]).toBeTypeOf('function');
            expect(calls[0][1]).not.toBe(on);

            write(count, 1);
            await tick();
            frame();
            node.remove();
            container.append(node);
            frame();

            expect(calls).toHaveLength(1);
        });

        it('runs a handler that takes only the element', () => {
            let node = element(),
                received: unknown = null;

            onconnect(node, (element) => { received = element; });
            frame();

            expect(received).toBe(node);
        });

        it('stacks across separate attribute objects and spreads, in order, each with its own bound on', () => {
            let bound: unknown[] = [],
                node = element(),
                order: string[] = [];

            setProperties(node, [
                { onconnect: (_element: Element, on: On) => { bound.push(on); order.push('a'); } },
                { onconnect: (_element: Element, on: On) => { bound.push(on); order.push('b'); } }
            ]);
            runtime(node, 'onconnect', (_element, on) => { bound.push(on); order.push('c'); });
            frame();

            expect(order).toEqual(['a', 'b', 'c']);
            expect(bound.every(on => typeof on === 'function')).toBe(true);
            expect(new Set(bound).size).toBe(3);
        });

        it('removes its bindings when the element is disposed, on every target', () => {
            using remove = vi.spyOn(document, 'removeEventListener');

            let calls = 0,
                dispose = () => {},
                node = element('button'),
                other = element('button'),
                target = new EventTarget();

            root((stop) => {
                dispose = stop;
                onconnect(node, (element, on) => {
                    on(element, 'click', () => { calls++; });
                    on(other, 'click', () => { calls++; }, { direct: true });
                    on(document, 'owned', () => { calls++; }, { capture: true });
                    on(target, 'owned', () => { calls++; });
                });
            });
            frame();

            node.click();
            other.click();
            document.dispatchEvent(new Event('owned'));
            target.dispatchEvent(new Event('owned'));

            expect(calls).toBe(4);

            dispose();
            node.click();
            other.click();
            document.dispatchEvent(new Event('owned'));
            target.dispatchEvent(new Event('owned'));

            expect(calls).toBe(4);
            expect(registered(remove, 'owned')).toBe(1);
        });

        it('keeps its bindings when the element is moved', async () => {
            let calls = 0,
                elsewhere = element(),
                node = element('button');

            root((stop) => {
                track(stop);
                onconnect(node, (_element, on) => {
                    on(document, 'moved', () => { calls++; });
                });
            });
            frame();

            document.dispatchEvent(new Event('moved'));
            node.remove();
            document.dispatchEvent(new Event('moved'));
            elsewhere.append(node);
            await tick();
            document.dispatchEvent(new Event('moved'));

            expect(calls).toBe(2);
        });

        it('does not run its bindings while the element is out of the document, on any target', () => {
            let calls: string[] = [],
                node = element('button'),
                other = element('button'),
                target = new EventTarget();

            root((stop) => {
                track(stop);
                onconnect(node, (element, on) => {
                    on(element, 'detached', () => { calls.push('element'); }, { direct: true });
                    on(other, 'click', () => { calls.push('other'); });
                    on(window, 'detached', () => { calls.push('window'); });
                    on(target, 'detached', () => { calls.push('target'); });
                });
            });
            frame();

            node.remove();
            node.dispatchEvent(new Event('detached'));
            other.click();
            window.dispatchEvent(new Event('detached'));
            target.dispatchEvent(new Event('detached'));

            expect(calls).toEqual([]);

            container.append(node);
            other.click();
            target.dispatchEvent(new Event('detached'));

            expect(calls).toEqual(['other', 'target']);
        });

        it('releases its bindings once foreign code removed the element past the end of the task', async () => {
            let calls = 0,
                node = element('button');

            root((stop) => {
                track(stop);
                onconnect(node, (_element, on) => {
                    on(window, 'healed', () => { calls++; });
                });
            });
            frame();

            window.dispatchEvent(new Event('healed'));
            node.remove();
            window.dispatchEvent(new Event('healed'));
            await tick();
            container.append(node);
            window.dispatchEvent(new Event('healed'));

            expect(calls).toBe(1);
        });

        it('binds with capture, direct, passive and once through its on', () => {
            let calls: string[] = [],
                node = element('button');

            using add = vi.spyOn(node, 'addEventListener');

            root((stop) => {
                track(stop);
                onconnect(node, (element, on) => {
                    on(element, 'click', () => { calls.push('bubble'); });
                    on(element, 'click', () => { calls.push('once'); }, { once: true });
                    on(container, 'click', () => { calls.push('capture'); }, { capture: true });
                    on(element, 'wheel', (e) => { e.preventDefault(); }, { direct: true, passive: false });
                });
            });
            frame();

            node.click();
            node.click();

            let wheel = new Event('wheel', { cancelable: true });

            node.dispatchEvent(wheel);

            expect(calls).toEqual(['capture', 'bubble', 'once', 'capture', 'bubble']);
            expect(add).toHaveBeenCalledWith('wheel', expect.any(Function), { capture: false, passive: false });
            expect(wheel.defaultPrevented).toBe(true);
        });

        it('returns a disposer and honours signal for each binding', () => {
            let calls = { disposed: 0, kept: 0, signal: 0 },
                controller = new AbortController(),
                disposer: VoidFunction = () => {},
                node = element('button');

            root((stop) => {
                track(stop);
                onconnect(node, (element, on) => {
                    disposer = on(element, 'click', () => { calls.disposed++; });
                    on(element, 'click', () => { calls.signal++; }, { signal: controller.signal });
                    on(element, 'click', () => { calls.kept++; });
                });
            });
            frame();

            disposer();
            controller.abort();
            node.click();

            expect(calls).toEqual({ disposed: 0, kept: 1, signal: 0 });
        });

        it.each([
            ['an attribute', 'onconnect=${connect}'],
            ['a spread', '${{ onconnect: connect }}']
        ])('passes its on to a compiled handler bound through %s', (_label, attribute) => {
            let calls = 0,
                received: unknown[] = [],
                connect = (element: HTMLElement, on: On) => {
                    received.push(element, on);
                    on(element, 'click', () => { calls++; });
                };

            root((stop) => {
                track(stop);
                container.append(compile(`let value = html\`<button ${attribute}></button>\`;`, { connect }));
            });
            frame();

            let button = container.querySelector('button')!;

            button.click();

            expect(received[0]).toBe(button);
            expect(received[1]).toBeTypeOf('function');
            expect(received[1]).not.toBe(on);
            expect(calls).toBe(1);
        });

        it('rejects an on key at runtime', () => {
            let node = element();

            expect(() => runtime(node, 'on' as 'onconnect', () => {})).toThrow(`@esportsplus/template: 'on' is not an attribute`);
            expect(() => runtime(node, 'On' as 'onconnect', () => {})).toThrow(`'On' is not an attribute`);
            expect(() => setProperties(node, { on: () => {} })).toThrow(`'on' is not an attribute`);
        });
    });
});
