import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { read, signal, write } from '@esportsplus/reactivity';
import { CLEANUP } from '../src/constants';
import { ondisconnect } from '../src/slot/cleanup';
import type { Element } from '../src/types';

import render from '../src/render';


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

            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
        });

        it('handles undefined', () => {
            render(container, undefined);

            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
        });

        it('handles false', () => {
            render(container, false);

            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
        });

        it('handles empty string', () => {
            render(container, '');

            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
        });

        it('renders 0', () => {
            render(container, 0);

            expect(container.textContent).toContain('0');
        });
    });

    describe('disposer', () => {
        it('removes static content and the anchor', () => {
            let dispose = render(container, ['One', 'Two']);

            expect(container.textContent).toBe('OneTwo');

            dispose();

            expect(container.childNodes.length).toBe(0);
        });

        it('stops reactive content and ignores a pending frame', async () => {
            let s = signal('before'),
                dispose = render(container, () => read(s)),
                textnode = container.lastChild!;

            expect(textnode.nodeValue).toBe('before');

            write(s, 'after');
            dispose();

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(container.childNodes.length).toBe(0);
            expect(textnode.nodeValue).toBe('before');
        });

        it('removes attribute bindings from the parent without touching its other cleanups', () => {
            let clicks = 0,
                other = vi.fn(),
                s = signal('a');

            ondisconnect(container as unknown as Element, other);

            let dispose = render(container, { onclick: () => { clicks++; }, title: () => read(s) }, 'Content');

            container.click();

            expect(clicks).toBe(1);
            expect(container.title).toBe('a');

            dispose();
            container.click();
            write(s, 'b');

            expect(clicks).toBe(1);
            expect(container.title).toBe('a');
            expect(other).not.toHaveBeenCalled();
            expect((container as unknown as Element)[CLEANUP]).toEqual([other]);
        });
    });
});
