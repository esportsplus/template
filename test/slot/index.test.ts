import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import slot from '../../src/slot';
import { marker } from '../../src/utilities';
import type { Element } from '../../src/types';


describe('slot/index', () => {
    let container: HTMLElement,
        anchor: Element;

    beforeEach(() => {
        container = document.createElement('div');
        anchor = marker.cloneNode() as unknown as Element;
        container.appendChild(anchor as unknown as Node);
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    describe('function rendering', () => {
        it('creates EffectSlot for function', () => {
            slot(anchor, () => 'Effect Content');

            expect(container.textContent).toContain('Effect Content');
        });

        it('handles function returning DOM elements', () => {
            slot(anchor, () => {
                let span = document.createElement('span');

                span.textContent = 'Dynamic Span';

                return span;
            });

            expect(container.querySelector('span')?.textContent).toBe('Dynamic Span');
        });

        it('handles function returning DocumentFragment', () => {
            slot(anchor, () => {
                let frag = document.createDocumentFragment(),
                    div = document.createElement('div');

                div.textContent = 'Fragment Content';
                frag.appendChild(div);

                return frag;
            });

            expect(container.querySelector('div')?.textContent).toBe('Fragment Content');
        });
    });

    describe('static rendering', () => {
        it('renders string after anchor', () => {
            slot(anchor, 'Static String');

            expect(container.textContent).toContain('Static String');
        });

        it('renders number after anchor', () => {
            slot(anchor, 42);

            expect(container.textContent).toContain('42');
        });

        it('renders DOM node after anchor', () => {
            let span = document.createElement('span');

            span.textContent = 'Static Span';

            slot(anchor, span);

            expect(container.querySelector('span')?.textContent).toBe('Static Span');
        });

        it('renders DocumentFragment after anchor', () => {
            let frag = document.createDocumentFragment(),
                div = document.createElement('div');

            div.textContent = 'Fragment Div';
            frag.appendChild(div);

            slot(anchor, frag);

            expect(container.querySelector('div')?.textContent).toBe('Fragment Div');
        });

        it('renders array after anchor', () => {
            slot(anchor, ['One', 'Two', 'Three']);

            expect(container.textContent).toContain('One');
            expect(container.textContent).toContain('Two');
            expect(container.textContent).toContain('Three');
        });
    });

    describe('null/false/undefined handling', () => {
        it('handles null', () => {
            slot(anchor, null);

            // Should not add content after anchor
            expect(container.childNodes.length).toBe(1);
        });

        it('handles false', () => {
            slot(anchor, false);

            expect(container.childNodes.length).toBe(1);
        });

        it('handles undefined', () => {
            slot(anchor, undefined);

            expect(container.childNodes.length).toBe(1);
        });

        it('handles empty string', () => {
            slot(anchor, '');

            expect(container.childNodes.length).toBe(1);
        });
    });

    describe('ordering', () => {
        it('content appears after anchor', () => {
            slot(anchor, 'After');

            let anchorIndex = Array.from(container.childNodes).indexOf(anchor as unknown as ChildNode),
                textIndex = Array.from(container.childNodes).findIndex(
                    node => node.textContent === 'After'
                );

            expect(textIndex).toBeGreaterThan(anchorIndex);
        });

        it('multiple slots maintain order', () => {
            let anchor2 = marker.cloneNode() as unknown as Element;

            container.appendChild(anchor2 as unknown as Node);

            slot(anchor, 'First');
            slot(anchor2, 'Second');

            let text = container.textContent!;
            let firstIndex = text.indexOf('First'),
                secondIndex = text.indexOf('Second');

            expect(firstIndex).toBeLessThan(secondIndex);
        });
    });

    describe('nested content', () => {
        it('renders nested arrays', () => {
            slot(anchor, [['Nested', 'Array'], 'Flat']);

            expect(container.textContent).toContain('Nested');
            expect(container.textContent).toContain('Array');
            expect(container.textContent).toContain('Flat');
        });

        it('renders mixed nested content', () => {
            let span = document.createElement('span');

            span.textContent = 'Span';

            slot(anchor, ['Text', span, ['More', 'Text']]);

            expect(container.textContent).toContain('Text');
            expect(container.querySelector('span')?.textContent).toBe('Span');
            expect(container.textContent).toContain('More');
        });
    });
});
