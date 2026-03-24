import { describe, expect, it, beforeEach } from 'vitest';
import { setList, setProperty, setProperties } from '../src/attributes';
import type { Element } from '../src/types';


describe('attributes', () => {
    let element: HTMLElement & Record<symbol, unknown>;

    beforeEach(() => {
        element = document.createElement('div') as HTMLElement & Record<symbol, unknown>;
    });

    describe('setProperty', () => {
        it('sets string property', () => {
            setProperty(element as unknown as Element, 'id', 'test-id');

            expect(element.id).toBe('test-id');
        });

        it('sets numeric property as attribute', () => {
            setProperty(element as unknown as Element, 'data-count', 42);

            expect(element.getAttribute('data-count')).toBe('42');
        });

        it('sets boolean true property', () => {
            let input = document.createElement('input') as HTMLInputElement & Record<symbol, unknown>;

            setProperty(input as unknown as Element, 'disabled', true);

            expect(input.disabled).toBe(true);
        });

        it('removes attribute for null value', () => {
            element.setAttribute('data-test', 'value');
            setProperty(element as unknown as Element, 'data-test', null);

            expect(element.hasAttribute('data-test')).toBe(false);
        });

        it('removes attribute for false value', () => {
            element.setAttribute('data-test', 'value');
            setProperty(element as unknown as Element, 'data-test', false);

            expect(element.hasAttribute('data-test')).toBe(false);
        });

        it('removes attribute for empty string', () => {
            element.setAttribute('data-test', 'value');
            setProperty(element as unknown as Element, 'data-test', '');

            expect(element.hasAttribute('data-test')).toBe(false);
        });

        it('sets className for class property', () => {
            setProperty(element as unknown as Element, 'class', 'my-class');

            expect(element.className).toBe('my-class');
        });

        it('sets style attribute', () => {
            setProperty(element as unknown as Element, 'style', 'color: red');

            expect(element.getAttribute('style')).toBe('color: red');
        });

        it('sets data-* attributes via setAttribute', () => {
            setProperty(element as unknown as Element, 'data-value', 'test');

            expect(element.getAttribute('data-value')).toBe('test');
        });

        it('handles SVG elements via ownerSVGElement check', () => {
            let rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect') as SVGRectElement;
            let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;

            svg.appendChild(rect);

            setProperty(rect as unknown as Element, 'width', '100');

            expect(rect.getAttribute('width')).toBe('100');
        });
    });

    describe('setList', () => {
        it('applies class list from string', () => {
            setList(element as unknown as Element, 'class', 'foo bar baz');

            // Class values are applied to className
            expect(element.className).toContain('foo');
            expect(element.className).toContain('bar');
            expect(element.className).toContain('baz');
        });

        it('merges static and dynamic classes', () => {
            setList(element as unknown as Element, 'class', 'dynamic', { class: 'static' });

            expect(element.className).toBe('static dynamic');
        });

        it('applies style list from string', () => {
            setList(element as unknown as Element, 'style', 'color: red');

            expect(element.getAttribute('style')).toContain('color');
        });

        it('merges static and dynamic styles', () => {
            setList(element as unknown as Element, 'style', 'font-size: 14px', { style: 'color: red' });

            expect(element.getAttribute('style')).toBe('color: red;font-size: 14px');
        });

        it('handles null value', () => {
            setList(element as unknown as Element, 'class', null);

            expect(element.className).toBe('');
        });

        it('handles false value', () => {
            setList(element as unknown as Element, 'class', false);

            expect(element.className).toBe('');
        });

        it('handles empty string value', () => {
            setList(element as unknown as Element, 'class', '');

            expect(element.className).toBe('');
        });

        it('handles array of values', () => {
            setList(element as unknown as Element, 'class', ['foo', 'bar', 'baz']);

            expect(element.className).toContain('foo');
            expect(element.className).toContain('bar');
            expect(element.className).toContain('baz');
        });

        it('filters null/false/empty from array', () => {
            setList(element as unknown as Element, 'class', ['foo', null, 'bar', false, '', 'baz']);

            expect(element.className).toContain('foo');
            expect(element.className).toContain('bar');
            expect(element.className).toContain('baz');
        });

        it('applies whitespace-padded class values', () => {
            setList(element as unknown as Element, 'class', '  foo   bar  ');

            expect(element.className).toContain('foo');
            expect(element.className).toContain('bar');
        });

        it('handles style with semicolons', () => {
            setList(element as unknown as Element, 'style', 'color: red; font-size: 14px;');

            expect(element.getAttribute('style')).toContain('color: red');
            expect(element.getAttribute('style')).toContain('font-size: 14px');
        });
    });

    describe('setProperties', () => {
        it('sets multiple properties from object', () => {
            setProperties(element as unknown as Element, {
                'data-one': 'value1',
                'data-two': 'value2',
                id: 'my-id'
            });

            expect(element.id).toBe('my-id');
            expect(element.getAttribute('data-one')).toBe('value1');
            expect(element.getAttribute('data-two')).toBe('value2');
        });

        it('handles null properties object', () => {
            setProperties(element as unknown as Element, null);

            expect(element.attributes.length).toBe(0);
        });

        it('handles undefined properties object', () => {
            setProperties(element as unknown as Element, undefined);

            expect(element.attributes.length).toBe(0);
        });

        it('handles false properties object', () => {
            setProperties(element as unknown as Element, false);

            expect(element.attributes.length).toBe(0);
        });

        it('filters null property values', () => {
            setProperties(element as unknown as Element, {
                'data-keep': 'value',
                'data-skip': null as unknown as string
            });

            expect(element.getAttribute('data-keep')).toBe('value');
            expect(element.hasAttribute('data-skip')).toBe(false);
        });

        it('filters false property values', () => {
            setProperties(element as unknown as Element, {
                'data-keep': 'value',
                'data-skip': false as unknown as string
            });

            expect(element.getAttribute('data-keep')).toBe('value');
            expect(element.hasAttribute('data-skip')).toBe(false);
        });

        it('filters empty string property values', () => {
            setProperties(element as unknown as Element, {
                'data-keep': 'value',
                'data-skip': ''
            });

            expect(element.getAttribute('data-keep')).toBe('value');
            expect(element.hasAttribute('data-skip')).toBe(false);
        });

        it('handles class property via setList', () => {
            setProperties(element as unknown as Element, {
                class: 'foo bar'
            });

            expect(element.className).toContain('foo');
            expect(element.className).toContain('bar');
        });

        it('handles style property via setList', () => {
            setProperties(element as unknown as Element, {
                style: 'color: red'
            });

            expect(element.getAttribute('style')).toContain('color: red');
        });

        it('handles array of properties objects', () => {
            setProperties(element as unknown as Element, [
                { 'data-one': 'value1' },
                { 'data-two': 'value2' }
            ]);

            expect(element.getAttribute('data-one')).toBe('value1');
            expect(element.getAttribute('data-two')).toBe('value2');
        });

        it('later properties override earlier ones in array', () => {
            setProperties(element as unknown as Element, [
                { id: 'first' },
                { id: 'second' }
            ]);

            expect(element.id).toBe('second');
        });

        it('handles nested arrays', () => {
            setProperties(element as unknown as Element, [
                [{ 'data-one': 'value1' }],
                { 'data-two': 'value2' }
            ] as unknown as Record<string, string>[]);

            expect(element.getAttribute('data-one')).toBe('value1');
            expect(element.getAttribute('data-two')).toBe('value2');
        });

        it('handles static attributes merge with class', () => {
            setProperties(element as unknown as Element, { class: 'dynamic' }, { class: 'static' });

            expect(element.className).toBe('static dynamic');
        });

        it('handles static attributes merge with style', () => {
            setProperties(element as unknown as Element, { style: 'font-size: 14px' }, { style: 'color: red' });

            expect(element.getAttribute('style')).toContain('color: red');
            expect(element.getAttribute('style')).toContain('font-size: 14px');
        });
    });

    describe('reactive functions', () => {
        it('setProperty handles reactive function', async () => {
            let value = 'initial';

            setProperty(element as unknown as Element, 'id', () => value);

            expect(element.id).toBe('initial');
        });

        it('setList handles reactive function for class', async () => {
            let classes = 'foo bar';

            setList(element as unknown as Element, 'class', () => classes);

            // Reactive functions update the element className through the effect system
            expect(element.className).toContain('foo');
            expect(element.className).toContain('bar');
        });

        it('setList handles reactive function for style', async () => {
            let style = 'color: red';

            setList(element as unknown as Element, 'style', () => style);

            // Reactive functions update the element style through the effect system
            expect(element.getAttribute('style')).toContain('color');
        });
    });
});
