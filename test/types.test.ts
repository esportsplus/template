import { describe, expect, expectTypeOf, it } from 'vitest';
import component from '../src/component';
import { delegate, direct, on, ondocument, onwindow } from '../src/event';
import type { Attributes, Effect, Element as Bound } from '../src/types';
import type * as Public from '../src';


describe('types', () => {
    describe('Attributes listeners', () => {
        it('types element events with the element as this', () => {
            let attributes: Attributes<HTMLInputElement> = {
                    onclick(event) {
                        expectTypeOf(event).toEqualTypeOf<PointerEvent>();
                        expectTypeOf(this).toEqualTypeOf<HTMLInputElement>();
                    },
                    onceinput(event) {
                        expectTypeOf(event).toEqualTypeOf<InputEvent>();
                    },
                    onkeydown(event) {
                        expectTypeOf(event).toEqualTypeOf<KeyboardEvent>();
                    }
                };

            expect(attributes).toBeDefined();
        });

        it('types document events with the element as this', () => {
            let attributes: Attributes<HTMLInputElement> = {
                    oncedocumentvisibilitychange(event) {
                        expectTypeOf(event).toEqualTypeOf<Event>();
                    },
                    ondocumentclick(event) {
                        expectTypeOf(event).toEqualTypeOf<PointerEvent>();
                        expectTypeOf(this).toEqualTypeOf<HTMLInputElement>();
                    }
                };

            expect(attributes).toBeDefined();
        });

        it('types window events with the element as this', () => {
            let attributes: Attributes<HTMLInputElement> = {
                    oncewindowstorage(event) {
                        expectTypeOf(event).toEqualTypeOf<StorageEvent>();
                    },
                    onwindowresize(event) {
                        expectTypeOf(event).toEqualTypeOf<UIEvent>();
                        expectTypeOf(this).toEqualTypeOf<HTMLInputElement>();
                    }
                };

            expect(attributes).toBeDefined();
        });

        it('types lifecycle listeners with the element', () => {
            let attributes: Attributes<HTMLInputElement> = {
                    onconnect: (element) => expectTypeOf(element).toEqualTypeOf<HTMLInputElement>(),
                    ontick: (dispose, element) => {
                        expectTypeOf(dispose).toEqualTypeOf<VoidFunction>();
                        expectTypeOf(element).toEqualTypeOf<HTMLInputElement>();
                    }
                };

            expect(attributes).toBeDefined();
        });

        it('passes every listener a disposer', () => {
            let attributes: Attributes<HTMLInputElement> = {
                    onclick(_event, dispose) {
                        expectTypeOf(dispose).toEqualTypeOf<VoidFunction>();
                    },
                    ondocumentkeydown(_event, dispose) {
                        expectTypeOf(dispose).toEqualTypeOf<VoidFunction>();
                    }
                };

            expect(attributes).toBeDefined();
        });

        it('types onconnect with the element and an on() bound to it', () => {
            let attributes: Attributes<HTMLInputElement> = {
                    onconnect: (element, bind) => {
                        expectTypeOf(element).toEqualTypeOf<HTMLInputElement>();
                        expectTypeOf(bind).toEqualTypeOf<typeof on>();
                    }
                };

            expect(attributes).toBeDefined();
        });

        it('rejects an on key', () => {
            let attributes: Attributes = {
                    // @ts-expect-error listeners bind through onconnect's on
                    on: () => {}
                };

            expect(attributes).toBeDefined();
        });

        it('rejects onactive keys', () => {
            let attributes: Attributes = {
                    // @ts-expect-error onactive keys are not event keys
                    onactivewheel: () => {}
                };

            expect(attributes).toBeDefined();
        });
    });

    describe('on()', () => {
        // Type assertions only: jsdom has no matchMedia, so this is never called
        function check(button: HTMLButtonElement, media: MediaQueryList, svg: SVGSVGElement, target: EventTarget) {
            on(document, 'visibilitychange', function (event, dispose) {
                expectTypeOf(this).toEqualTypeOf<Document>();
                expectTypeOf(event).toEqualTypeOf<Event>();
                expectTypeOf(dispose).toEqualTypeOf<VoidFunction>();
            });
            on(document, 'keydown', (event) => expectTypeOf(event).toEqualTypeOf<KeyboardEvent>(), { capture: true });
            on(window, 'resize', function (event) {
                expectTypeOf(this).toEqualTypeOf<Window>();
                expectTypeOf(event).toEqualTypeOf<UIEvent>();
            });
            on(media, 'change', function (event) {
                expectTypeOf(this).toEqualTypeOf<MediaQueryList>();
                expectTypeOf(event).toEqualTypeOf<MediaQueryListEvent>();
            });
            on(button, 'click', function (event) {
                expectTypeOf(this).toEqualTypeOf<HTMLButtonElement>();
                expectTypeOf(event).toEqualTypeOf<PointerEvent>();
            }, { direct: true, once: true });
            on(svg, 'wheel', function (event) {
                expectTypeOf(this).toEqualTypeOf<SVGSVGElement>();
                expectTypeOf(event).toEqualTypeOf<WheelEvent>();
            }, { passive: false, signal: AbortSignal.timeout(0) });
            on(target, 'custom', function (event) {
                expectTypeOf(this).toEqualTypeOf<EventTarget>();
                expectTypeOf(event).toEqualTypeOf<Event>();
            });

            // @ts-expect-error options are an object
            on(document, 'keydown', () => {}, true);

            expectTypeOf(on(target, 'custom', () => {})).toEqualTypeOf<VoidFunction>();
        }

        // Attributes['onconnect'] names it, so a package emitting declarations for a component that binds one must reach it
        it('is exported from the entry point as On', () => {
            expectTypeOf<typeof on>().toEqualTypeOf<Public.On>();
            expectTypeOf<NonNullable<Public.Attributes['onconnect']>>().parameter(1).toEqualTypeOf<Public.On>();
        });

        it('types the listener by target and event', () => {
            expect(check).toBeTypeOf('function');
        });
    });

    describe('delegate(), direct(), ondocument() and onwindow()', () => {
        // What the compiler emits for event keys, inline attribute objects included: their handlers take the key's
        // types from it. Type assertions only, never called
        function check(element: Bound) {
            delegate(element, 'input', function (event, dispose) {
                expectTypeOf(this).toEqualTypeOf<HTMLElement>();
                expectTypeOf(event).toEqualTypeOf<InputEvent>();
                expectTypeOf(dispose).toEqualTypeOf<VoidFunction>();
            });
            delegate(element, 'keydown', (event) => expectTypeOf(event).toEqualTypeOf<KeyboardEvent>(), { once: true });
            direct(element, 'focus', function (event, dispose) {
                expectTypeOf(this).toEqualTypeOf<HTMLElement>();
                expectTypeOf(event).toEqualTypeOf<FocusEvent>();
                expectTypeOf(dispose).toEqualTypeOf<VoidFunction>();
            });
            direct(element, 'submit', (event) => expectTypeOf(event).toEqualTypeOf<SubmitEvent>(), { once: true });
            ondocument(element, 'visibilitychange', function (event, dispose) {
                expectTypeOf(this).toEqualTypeOf<HTMLElement>();
                expectTypeOf(event).toEqualTypeOf<Event>();
                expectTypeOf(dispose).toEqualTypeOf<VoidFunction>();
            });
            ondocument(element, 'keydown', (event) => expectTypeOf(event).toEqualTypeOf<KeyboardEvent>(), { once: true });
            onwindow(element, 'storage', function (event, dispose) {
                expectTypeOf(this).toEqualTypeOf<HTMLElement>();
                expectTypeOf(event).toEqualTypeOf<StorageEvent>();
                expectTypeOf(dispose).toEqualTypeOf<VoidFunction>();
            });
            onwindow(element, 'resize', (event) => expectTypeOf(event).toEqualTypeOf<UIEvent>(), { once: true });

            // @ts-expect-error a click is not a keyboard event
            delegate(element, 'click', (event: KeyboardEvent) => event);
            // @ts-expect-error a focus is not a keyboard event
            direct(element, 'focus', (event: KeyboardEvent) => event);
            // @ts-expect-error a keydown is not a storage event
            ondocument(element, 'keydown', (event: StorageEvent) => event);
            // @ts-expect-error a resize is not a storage event
            onwindow(element, 'resize', (event: StorageEvent) => event);
            // @ts-expect-error attribute keys take no other options
            delegate(element, 'click', () => {}, { capture: true });
        }

        it('types the listener by attribute key', () => {
            expect(check).toBeTypeOf('function');
        });
    });

    describe('effects', () => {
        it('passes the element to class and style effects', () => {
            let attributes: Attributes<HTMLInputElement> = {
                    class: (element: HTMLInputElement) => element.value,
                    style: [(element: HTMLInputElement) => `width: ${element.size}ch`]
                };

            expect(attributes).toBeDefined();
        });

        it('passes a disposer to content effects', () => {
            let effect: Effect<string> = (dispose) => {
                    expectTypeOf(dispose).toEqualTypeOf<VoidFunction>();
                    return 'text';
                };

            expect(effect).toBeTypeOf('function');
        });
    });

    describe('component', () => {
        let factory = component<Attributes & { options: string[], selected?: string }>(
                (attributes) => attributes.selected ?? ''
            );

        it('accepts component props that share a name with DOM properties', () => {
            expect(factory({ options: [], selected: 'a' })).toBe('a');
        });

        it('calls with attributes only', () => {
            expect(factory.call({}, { options: [], selected: 'b' })).toBe('b');
        });

        it('binds a partial set of attributes', () => {
            let preset = factory.bind({ attributes: { class: 'preset' } });

            expectTypeOf(preset).toEqualTypeOf<typeof factory>();
            expect(preset({ options: [], selected: 'c' })).toBe('c');
        });
    });

    describe('component properties', () => {
        const INPUT = Symbol.for('test.component.input');

        type A = Attributes & { [INPUT]?: Attributes, selected?: string };

        let factory = component(
                function(this: { attributes?: A } | void, attributes: A) {
                    return (this?.attributes?.selected ?? '') + (attributes.selected ?? '');
                },
                { input: INPUT, size: 'md' }
            );

        it('assigns properties to the factory', () => {
            expectTypeOf(factory.input).toEqualTypeOf<typeof INPUT>();
            expectTypeOf(factory.size).toEqualTypeOf<'md'>();
            expect(factory.input).toBe(INPUT);
            expect(factory.size).toBe('md');
        });

        it('accepts assigned symbols as attribute keys', () => {
            expect(factory({ [factory.input]: { class: 'x' }, selected: 'a' })).toBe('a');
        });

        it('keeps properties on bound presets', () => {
            let preset = factory.bind({ attributes: { [factory.input]: { class: 'x' }, selected: 'p' } });

            expectTypeOf(preset).toEqualTypeOf<typeof factory>();
            expect(preset.input).toBe(INPUT);
            expect(preset.size).toBe('md');
            expect(preset({ selected: 'b' })).toBe('pb');
        });

        it('keeps properties when binding a bound preset', () => {
            let preset = factory.bind({ attributes: { selected: 'p' } }).bind({ attributes: { selected: 'q' } });

            expect(preset.input).toBe(INPUT);
            expect(preset({ selected: 'c' })).toBe('pc');
        });

        it('infers union attributes from the annotated template', () => {
            type U = Attributes & ({ selected?: string, state?: never } | { selected?: never, state: { selected: string } });

            let union = component((attributes: U) => attributes.selected ?? attributes.state?.selected ?? '', { input: INPUT });

            expectTypeOf<Parameters<typeof union>[0]>().toEqualTypeOf<U>();
            expect(union({ state: { selected: 'd' } })).toBe('d');
        });

        it('leaves factories without properties untouched', () => {
            let plain = component<Attributes>(() => '');

            expect(plain.bind).toBe(Function.prototype.bind);
            expectTypeOf(plain).toEqualTypeOf<ReturnType<typeof component<Attributes>>>();
        });
    });
});
