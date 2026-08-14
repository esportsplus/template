import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '../../src/slot';
import { fragment, marker, text } from '../../src/utilities';
import type { Element } from '../../src/types';


describe('slot/render', () => {
    let anchor: Element;

    beforeEach(() => {
        anchor = marker.cloneNode() as unknown as Element;
    });

    describe('null/undefined/false handling', () => {
        it('returns empty fragment for null', () => {
            let result = render(anchor, null);

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(0);
        });

        it('returns empty fragment for undefined', () => {
            let result = render(anchor, undefined);

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(0);
        });

        it('returns empty fragment for false', () => {
            let result = render(anchor, false);

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(0);
        });

        it('returns empty fragment for empty string', () => {
            let result = render(anchor, '');

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(0);
        });
    });

    describe('primitive handling', () => {
        it('renders string as text node', () => {
            let result = render(anchor, 'Hello World');

            expect(result.nodeType).toBe(Node.TEXT_NODE);
            expect(result.nodeValue).toBe('Hello World');
        });

        it('renders number as text node', () => {
            let result = render(anchor, 42);

            expect(result.nodeType).toBe(Node.TEXT_NODE);
            expect(result.nodeValue).toBe('42');
        });

        it('renders true as text node', () => {
            let result = render(anchor, true);

            expect(result.nodeType).toBe(Node.TEXT_NODE);
            expect(result.nodeValue).toBe('true');
        });

        it('renders bigint as text node', () => {
            let result = render(anchor, BigInt(9007199254740991));

            expect(result.nodeType).toBe(Node.TEXT_NODE);
            expect(result.nodeValue).toBe('9007199254740991');
        });
    });

    describe('Node handling', () => {
        it('returns existing Node as-is', () => {
            let div = document.createElement('div');

            div.textContent = 'Hello';

            let result = render(anchor, div);

            expect(result).toBe(div);
        });

        it('returns DocumentFragment as-is', () => {
            let frag = fragment('<span>Test</span>');
            let result = render(anchor, frag);

            expect(result).toBe(frag);
        });

        it('returns Text node as-is', () => {
            let textNode = text('Hello');
            let result = render(anchor, textNode);

            expect(result).toBe(textNode);
        });

        it('returns Comment node as-is', () => {
            let comment = document.createComment('test comment');
            let result = render(anchor, comment);

            expect(result).toBe(comment);
        });
    });

    describe('array handling', () => {
        it('returns empty fragment for empty array', () => {
            let result = render(anchor, []);

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(0);
        });

        it('renders single-element array', () => {
            let result = render(anchor, ['Hello']);

            expect(result.nodeType).toBe(Node.TEXT_NODE);
            expect(result.nodeValue).toBe('Hello');
        });

        it('renders multi-element string array as fragment', () => {
            let result = render(anchor, ['One', 'Two', 'Three']);

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(3);
            expect(result.childNodes[0].nodeValue).toBe('One');
            expect(result.childNodes[1].nodeValue).toBe('Two');
            expect(result.childNodes[2].nodeValue).toBe('Three');
        });

        it('renders mixed array content', () => {
            let div = document.createElement('div');

            div.textContent = 'Div';

            let result = render(anchor, ['Text', div, 42]);

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(3);
            expect(result.childNodes[0].nodeValue).toBe('Text');
            expect(result.childNodes[1]).toBe(div);
            expect(result.childNodes[2].nodeValue).toBe('42');
        });

        it('handles nested arrays', () => {
            let result = render(anchor, [['Nested', 'Array'], 'Flat']);

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(3);
        });

        it('filters null/false/empty from arrays', () => {
            let result = render(anchor, ['Keep', null, false, '', 'Also Keep']);

            expect(result).toBeInstanceOf(DocumentFragment);
            // render does not filter — null/false/'' yield empty fragments, so only real values produce nodes
            expect(result.childNodes[0].nodeValue).toBe('Keep');
            expect(result.childNodes[1].nodeValue).toBe('Also Keep');
        });
    });

    describe('NodeList handling', () => {
        it('renders NodeList as fragment', () => {
            let container = document.createElement('div');

            container.innerHTML = '<span>One</span><span>Two</span>';

            let nodeList = container.childNodes,
                result = render(anchor, nodeList);

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(2);
        });

        it('handles empty NodeList', () => {
            let container = document.createElement('div'),
                nodeList = container.childNodes,
                result = render(anchor, nodeList);

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(0);
        });
    });

    describe('parent-element anchor (parent-mode insert)', () => {
        it('returns a text node when the anchor is a parent element', () => {
            let parent = document.createElement('div') as unknown as Element,
                result = render(parent, 'Hello');

            expect(result.nodeType).toBe(Node.TEXT_NODE);
            expect(result.nodeValue).toBe('Hello');
        });

        it('returns the same fragment shape regardless of anchor kind', () => {
            let parent = document.createElement('div') as unknown as Element,
                viaMarker = render(anchor, ['One', 'Two', 'Three']),
                viaParent = render(parent, ['One', 'Two', 'Three']);

            expect(viaMarker).toBeInstanceOf(DocumentFragment);
            expect(viaParent).toBeInstanceOf(DocumentFragment);
            expect(viaParent.childNodes.length).toBe(viaMarker.childNodes.length);
        });

        it('appends a rendered text node into the parent element', () => {
            let parent = document.createElement('div') as unknown as Element;

            parent.appendChild(render(parent, 'child'));

            expect(parent.textContent).toBe('child');
            expect(parent.firstChild?.nodeType).toBe(Node.TEXT_NODE);
        });
    });

    describe('edge cases', () => {
        it('handles 0 as text node', () => {
            let result = render(anchor, 0);

            expect(result.nodeType).toBe(Node.TEXT_NODE);
            expect(result.nodeValue).toBe('0');
        });

        it('handles NaN as text node', () => {
            let result = render(anchor, NaN);

            expect(result.nodeType).toBe(Node.TEXT_NODE);
            expect(result.nodeValue).toBe('NaN');
        });

        it('handles Infinity as text node', () => {
            let result = render(anchor, Infinity);

            expect(result.nodeType).toBe(Node.TEXT_NODE);
            expect(result.nodeValue).toBe('Infinity');
        });

        it('handles object without nodeType as text', () => {
            let obj = { toString: () => 'Custom Object' };
            let result = render(anchor, obj);

            expect(result.nodeType).toBe(Node.TEXT_NODE);
        });
    });
});
