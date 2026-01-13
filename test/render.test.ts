import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import render from '../src/render';
import { marker } from '../src/utilities';


describe('render', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    describe('basic rendering', () => {
        it('renders string content', () => {
            render(container, 'Hello World');

            expect(container.textContent).toContain('Hello World');
        });

        it('renders number content', () => {
            render(container, 42);

            expect(container.textContent).toContain('42');
        });

        it('appends content after anchor', () => {
            render(container, 'New Content');

            // Content should be present after anchor marker
            expect(container.textContent).toContain('New Content');
        });

        it('appends anchor marker', () => {
            render(container, 'Content');

            let hasMarker = Array.from(container.childNodes).some(
                node => node.nodeType === Node.COMMENT_NODE && node.textContent === '$'
            );

            expect(hasMarker).toBe(true);
        });
    });

    describe('function rendering', () => {
        it('renders function return value', () => {
            render(container, () => 'Dynamic Content');

            expect(container.textContent).toContain('Dynamic Content');
        });

        it('creates EffectSlot for function', () => {
            render(container, () => 'Effect Content');

            // EffectSlot should render the content
            expect(container.textContent).toContain('Effect Content');
        });
    });

    describe('node rendering', () => {
        it('renders DocumentFragment', () => {
            let frag = document.createDocumentFragment(),
                span = document.createElement('span');

            span.textContent = 'Fragment Span';
            frag.appendChild(span);

            render(container, frag);

            expect(container.querySelector('span')?.textContent).toBe('Fragment Span');
        });

        it('renders HTMLElement', () => {
            let div = document.createElement('div');

            div.textContent = 'Rendered Div';

            render(container, div);

            expect(container.querySelector('div')?.textContent).toBe('Rendered Div');
        });
    });

    describe('array rendering', () => {
        it('renders array of strings', () => {
            render(container, ['One', 'Two', 'Three']);

            expect(container.textContent).toContain('One');
            expect(container.textContent).toContain('Two');
            expect(container.textContent).toContain('Three');
        });

        it('renders array of elements', () => {
            let span1 = document.createElement('span'),
                span2 = document.createElement('span');

            span1.textContent = 'Span 1';
            span2.textContent = 'Span 2';

            render(container, [span1, span2]);

            expect(container.querySelectorAll('span').length).toBe(2);
        });

        it('renders mixed array', () => {
            let span = document.createElement('span');

            span.textContent = 'Element';

            render(container, ['Text', span, 42]);

            expect(container.textContent).toContain('Text');
            expect(container.querySelector('span')?.textContent).toBe('Element');
            expect(container.textContent).toContain('42');
        });
    });

    describe('falsy values', () => {
        it('handles null', () => {
            render(container, null);

            // Should not throw, marker should be present
            expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
        });

        it('handles undefined', () => {
            render(container, undefined);

            expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
        });

        it('handles false', () => {
            render(container, false);

            expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
        });

        it('handles empty string', () => {
            render(container, '');

            expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
        });

        it('renders 0', () => {
            render(container, 0);

            expect(container.textContent).toContain('0');
        });
    });
});
