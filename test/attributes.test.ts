import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { read, signal, write } from '@esportsplus/reactivity';
import { setList, setProperties, setProperty } from '../src/attributes';
import type { Element } from '../src/types';


describe('attributes', () => {
    let container: HTMLElement,
        element: HTMLElement & Record<symbol, unknown>;

    beforeEach(() => {
        container = document.createElement('div');
        element = document.createElement('div') as HTMLElement & Record<symbol, unknown>;
        container.appendChild(element);
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
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

            expect(element.style.cssText).toContain('color: red');
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

            expect(element.style.cssText).toContain('color: red');
            expect(element.style.cssText).toContain('font-size: 14px');
        });

        it('seeds static class from an existing DOM attribute when no statics param is given', () => {
            element.setAttribute('class', 'static');
            setList(element as unknown as Element, 'class', 'dynamic');

            expect(element.className).toBe('static dynamic');
        });

        it('seeds static style from an existing DOM attribute when no statics param is given', () => {
            element.setAttribute('style', 'color: red');
            setList(element as unknown as Element, 'style', 'font-size: 14px');

            expect(element.style.cssText).toContain('color: red');
            expect(element.style.cssText).toContain('font-size: 14px');
        });

        it('prefers the statics param over the DOM attribute (existing callers unchanged)', () => {
            element.setAttribute('class', 'from-dom');
            setList(element as unknown as Element, 'class', 'dynamic', { class: 'static' });

            expect(element.className).toBe('static dynamic');
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

    describe('property off-transition (B1)', () => {
        it('resets checked from true to false through the IDL property', () => {
            let input = document.createElement('input') as HTMLInputElement & Record<symbol, unknown>;

            input.type = 'checkbox';

            setProperty(input as unknown as Element, 'checked', true);
            expect(input.checked).toBe(true);

            setProperty(input as unknown as Element, 'checked', false);
            expect(input.checked).toBe(false);
        });

        it('clears value from a string back to empty through the IDL property', () => {
            let input = document.createElement('input') as HTMLInputElement & Record<symbol, unknown>;

            setProperty(input as unknown as Element, 'value', 'abc');
            expect(input.value).toBe('abc');

            setProperty(input as unknown as Element, 'value', '');
            expect(input.value).toBe('');
        });

        it('resets disabled from true to false', () => {
            let input = document.createElement('input') as HTMLInputElement & Record<symbol, unknown>;

            setProperty(input as unknown as Element, 'disabled', true);
            expect(input.disabled).toBe(true);

            setProperty(input as unknown as Element, 'disabled', false);
            expect(input.disabled).toBe(false);
        });

        it('resets hidden from true to false', () => {
            setProperty(element as unknown as Element, 'hidden', true);
            expect(element.hidden).toBe(true);

            setProperty(element as unknown as Element, 'hidden', false);
            expect(element.hidden).toBe(false);
        });
    });

    describe('non-IDL attributes (B2)', () => {
        it('renders aria-label as an attribute', () => {
            setProperty(element as unknown as Element, 'aria-label', 'hi');

            expect(element.getAttribute('aria-label')).toBe('hi');
        });

        it('renders tabindex as an attribute', () => {
            setProperty(element as unknown as Element, 'tabindex', 3);

            expect(element.getAttribute('tabindex')).toBe('3');
        });

        it('renders for as an attribute', () => {
            let label = document.createElement('label') as HTMLElement & Record<symbol, unknown>;

            setProperty(label as unknown as Element, 'for', 'field');

            expect(label.getAttribute('for')).toBe('field');
        });

        it('renders a custom hyphenated attribute', () => {
            setProperty(element as unknown as Element, 'foo-bar', 'baz');

            expect(element.getAttribute('foo-bar')).toBe('baz');
        });

        it('still routes value through the IDL property', () => {
            let input = document.createElement('input') as HTMLInputElement & Record<symbol, unknown>;

            setProperty(input as unknown as Element, 'value', 'abc');

            expect(input.value).toBe('abc');
            expect(input.getAttribute('value')).toBe(null);
        });

        it('still routes checked through the IDL property', () => {
            let input = document.createElement('input') as HTMLInputElement & Record<symbol, unknown>;

            input.type = 'checkbox';

            setProperty(input as unknown as Element, 'checked', true);

            expect(input.checked).toBe(true);
            expect(input.getAttribute('checked')).toBe(null);
        });
    });

    describe('context collision (B12)', () => {
        it('applies a reactive attribute named "updating" without breaking batching', async () => {
            let s1 = signal('a'),
                s2 = signal('x');

            setProperty(element as unknown as Element, 'updating', () => read(s1));
            setProperty(element as unknown as Element, 'id', () => read(s2));

            expect(element.getAttribute('updating')).toBe('a');
            expect(element.id).toBe('x');

            write(s1, 'b');
            write(s2, 'y');

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(element.getAttribute('updating')).toBe('b');
            expect(element.id).toBe('y');
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

            expect(element.className).toContain('foo');
            expect(element.className).toContain('bar');
        });

        it('setList handles reactive function for style', async () => {
            let style = 'color: red';

            setList(element as unknown as Element, 'style', () => style);

            expect(element.getAttribute('style')).toContain('color');
        });
    });

    describe('reactive updates (schedule/task path)', () => {
        it('removes stale dynamic class values on reactive update', async () => {
            let s = signal('foo bar');

            setList(element as unknown as Element, 'class', () => read(s));

            expect(element.className).toContain('foo');
            expect(element.className).toContain('bar');

            write(s, 'foo baz');

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(element.className).toContain('foo');
            expect(element.className).toContain('baz');
            expect(element.className).not.toContain('bar');
        });

        it('removes stale dynamic style values on reactive update', async () => {
            let s = signal('color: red; font-size: 14px');

            setList(element as unknown as Element, 'style', () => read(s));

            expect(element.getAttribute('style')).toContain('color: red');
            expect(element.getAttribute('style')).toContain('font-size: 14px');

            write(s, 'color: blue');

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(element.getAttribute('style')).toContain('color: blue');
            expect(element.getAttribute('style')).not.toContain('font-size: 14px');
        });

        it('schedules property update via RAF on reactive change', async () => {
            let s = signal('first');

            setProperty(element as unknown as Element, 'id', () => read(s));

            expect(element.id).toBe('first');

            write(s, 'second');

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(element.id).toBe('second');
        });

        it('batches multiple property updates in single RAF', async () => {
            let s1 = signal('a'),
                s2 = signal('x');

            setProperty(element as unknown as Element, 'id', () => read(s1));
            setProperty(element as unknown as Element, 'data-value', () => read(s2));

            expect(element.id).toBe('a');
            expect(element.getAttribute('data-value')).toBe('x');

            write(s1, 'b');
            write(s2, 'y');

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(element.id).toBe('b');
            expect(element.getAttribute('data-value')).toBe('y');
        });

        it('clears class via reactive update to empty', async () => {
            let s = signal('foo bar');

            setList(element as unknown as Element, 'class', () => read(s));

            expect(element.className).toContain('foo');

            write(s, '');

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(element.className).not.toContain('foo');
            expect(element.className).not.toContain('bar');
        });
    });

    describe('setProperties event handler routing', () => {
        it('routes onclick handler function to runtime/delegate', () => {
            let clicked = false;

            setProperties(element as unknown as Element, {
                onclick: () => { clicked = true; }
            });

            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(clicked).toBe(true);
        });

        it('routes onmousedown handler function to runtime/delegate', () => {
            let fired = false;

            setProperties(element as unknown as Element, {
                onmousedown: () => { fired = true; }
            });

            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

            expect(fired).toBe(true);
        });

        it('routes onfocus handler function to runtime/on (direct attach)', () => {
            let focused = false;

            setProperties(element as unknown as Element, {
                onfocus: () => { focused = true; }
            });

            element.dispatchEvent(new FocusEvent('focus'));

            expect(focused).toBe(true);
        });

        it('routes non-event function property via reactive', () => {
            let s = signal('hello');

            setProperties(element as unknown as Element, {
                'data-val': () => read(s)
            });

            expect(element.getAttribute('data-val')).toBe('hello');
        });
    });
});
