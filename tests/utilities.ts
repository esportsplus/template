import { describe, expect, it, beforeEach } from 'vitest';
import { clone, fragment, marker, raf, template, text } from '../src/utilities';


describe('utilities', () => {
    describe('fragment', () => {
        it('creates empty DocumentFragment from empty string', () => {
            let frag = fragment('');

            expect(frag).toBeInstanceOf(DocumentFragment);
            expect(frag.childNodes.length).toBe(0);
        });

        it('creates DocumentFragment with single element', () => {
            let frag = fragment('<div>Hello</div>');

            expect(frag.childNodes.length).toBe(1);
            expect(frag.firstChild).toBeInstanceOf(HTMLDivElement);
            expect((frag.firstChild as HTMLDivElement).textContent).toBe('Hello');
        });

        it('creates DocumentFragment with multiple elements', () => {
            let frag = fragment('<span>One</span><span>Two</span><span>Three</span>');

            expect(frag.childNodes.length).toBe(3);
            expect((frag.childNodes[0] as HTMLSpanElement).textContent).toBe('One');
            expect((frag.childNodes[1] as HTMLSpanElement).textContent).toBe('Two');
            expect((frag.childNodes[2] as HTMLSpanElement).textContent).toBe('Three');
        });

        it('creates DocumentFragment with nested elements', () => {
            let frag = fragment('<div><span><strong>Nested</strong></span></div>');
            let div = frag.firstChild as HTMLDivElement,
                span = div.firstChild as HTMLSpanElement,
                strong = span.firstChild as HTMLElement;

            expect(div.tagName).toBe('DIV');
            expect(span.tagName).toBe('SPAN');
            expect(strong.tagName).toBe('STRONG');
            expect(strong.textContent).toBe('Nested');
        });

        it('creates DocumentFragment with text nodes', () => {
            let frag = fragment('Hello <b>World</b>!');

            expect(frag.childNodes.length).toBe(3);
            expect(frag.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
            expect(frag.childNodes[0].textContent).toBe('Hello ');
            expect((frag.childNodes[1] as HTMLElement).tagName).toBe('B');
            expect(frag.childNodes[2].nodeType).toBe(Node.TEXT_NODE);
            expect(frag.childNodes[2].textContent).toBe('!');
        });

        it('creates DocumentFragment with comments', () => {
            let frag = fragment('<!-- comment --><div>Content</div>');

            expect(frag.childNodes.length).toBe(2);
            expect(frag.childNodes[0].nodeType).toBe(Node.COMMENT_NODE);
            expect(frag.childNodes[0].textContent).toBe(' comment ');
        });

        it('handles self-closing tags', () => {
            let frag = fragment('<input type="text"><br><hr>');

            expect(frag.childNodes.length).toBe(3);
            expect((frag.childNodes[0] as HTMLInputElement).tagName).toBe('INPUT');
            expect((frag.childNodes[1] as HTMLBRElement).tagName).toBe('BR');
            expect((frag.childNodes[2] as HTMLHRElement).tagName).toBe('HR');
        });
    });

    describe('clone', () => {
        it('clones DocumentFragment deeply by default', () => {
            let original = fragment('<div><span>Content</span></div>'),
                cloned = clone(original);

            expect(cloned).toBeInstanceOf(DocumentFragment);
            expect(cloned).not.toBe(original);
            expect(cloned.firstChild).not.toBe(original.firstChild);
            expect((cloned.firstChild as HTMLDivElement).innerHTML).toBe('<span>Content</span>');
        });

        it('clones DocumentFragment shallowly when deep=false', () => {
            let original = fragment('<div><span>Content</span></div>'),
                cloned = clone(original, false);

            expect(cloned).toBeInstanceOf(DocumentFragment);
            expect(cloned.childNodes.length).toBe(0);
        });

        it('clones single Node deeply', () => {
            let original = document.createElement('div');

            original.innerHTML = '<span>Nested</span>';

            let cloned = clone(original);

            expect(cloned).toBeInstanceOf(HTMLDivElement);
            expect(cloned).not.toBe(original);
            expect((cloned as HTMLDivElement).innerHTML).toBe('<span>Nested</span>');
        });

        it('preserves element attributes when cloning', () => {
            let original = document.createElement('input');

            original.setAttribute('type', 'text');
            original.setAttribute('value', 'test');
            original.setAttribute('disabled', '');

            let cloned = clone(original) as HTMLInputElement;

            expect(cloned.getAttribute('type')).toBe('text');
            expect(cloned.getAttribute('value')).toBe('test');
            expect(cloned.hasAttribute('disabled')).toBe(true);
        });
    });

    describe('template', () => {
        it('returns a factory function', () => {
            let factory = template('<div>Hello</div>');

            expect(typeof factory).toBe('function');
        });

        it('factory returns DocumentFragment', () => {
            let factory = template('<div>Hello</div>'),
                result = factory();

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.firstChild).toBeInstanceOf(HTMLDivElement);
        });

        it('factory caches and clones template', () => {
            let factory = template('<div>Hello</div>'),
                first = factory(),
                second = factory();

            expect(first).not.toBe(second);
            expect(first.firstChild).not.toBe(second.firstChild);
            expect((first.firstChild as HTMLDivElement).outerHTML).toBe('<div>Hello</div>');
            expect((second.firstChild as HTMLDivElement).outerHTML).toBe('<div>Hello</div>');
        });

        it('handles complex templates with multiple elements', () => {
            let factory = template('<header>Header</header><main>Main</main><footer>Footer</footer>'),
                result = factory();

            expect(result.childNodes.length).toBe(3);
            expect((result.childNodes[0] as HTMLElement).tagName).toBe('HEADER');
            expect((result.childNodes[1] as HTMLElement).tagName).toBe('MAIN');
            expect((result.childNodes[2] as HTMLElement).tagName).toBe('FOOTER');
        });

        it('handles templates with slot markers', () => {
            let factory = template('<div><!--$--></div>'),
                result = factory(),
                div = result.firstChild as HTMLDivElement;

            expect(div.childNodes.length).toBe(1);
            expect(div.firstChild!.nodeType).toBe(Node.COMMENT_NODE);
            expect(div.firstChild!.textContent).toBe('$');
        });

        it('handles empty template', () => {
            let factory = template(''),
                result = factory();

            expect(result).toBeInstanceOf(DocumentFragment);
            expect(result.childNodes.length).toBe(0);
        });

        it('handles SVG template', () => {
            let factory = template('<svg><rect width="100" height="100"></rect></svg>'),
                result = factory(),
                svg = result.firstChild as SVGSVGElement;

            expect(svg.tagName.toLowerCase()).toBe('svg');
            expect(svg.firstChild!.nodeName.toLowerCase()).toBe('rect');
        });
    });

    describe('marker', () => {
        it('is a comment node', () => {
            expect(marker.nodeType).toBe(Node.COMMENT_NODE);
        });

        it('has $ as content', () => {
            expect(marker.textContent).toBe('$');
        });

        it('can be cloned', () => {
            let cloned = marker.cloneNode();

            expect(cloned.nodeType).toBe(Node.COMMENT_NODE);
            expect(cloned.textContent).toBe('$');
            expect(cloned).not.toBe(marker);
        });
    });

    describe('text', () => {
        it('creates text node with empty value', () => {
            let node = text('');

            expect(node.nodeType).toBe(Node.TEXT_NODE);
            expect(node.nodeValue).toBe('');
        });

        it('creates text node with string value', () => {
            let node = text('Hello World');

            expect(node.nodeType).toBe(Node.TEXT_NODE);
            expect(node.nodeValue).toBe('Hello World');
        });

        it('creates independent text nodes', () => {
            let node1 = text('First'),
                node2 = text('Second');

            expect(node1).not.toBe(node2);
            expect(node1.nodeValue).toBe('First');
            expect(node2.nodeValue).toBe('Second');
        });

        it('handles special characters', () => {
            let node = text('<script>alert("xss")</script>');

            expect(node.nodeValue).toBe('<script>alert("xss")</script>');
        });

        it('handles unicode', () => {
            let node = text('Hello 👋 World 🌍');

            expect(node.nodeValue).toBe('Hello 👋 World 🌍');
        });
    });

    describe('raf', () => {
        it('is requestAnimationFrame', () => {
            expect(raf).toBe(globalThis.requestAnimationFrame);
        });
    });
});
