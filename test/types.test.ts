import { describe, expect, expectTypeOf, it } from 'vitest';
import component from '../src/component';
import type { Attributes, Effect } from '../src/types';


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
});
