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
