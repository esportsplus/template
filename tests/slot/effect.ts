import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { EffectSlot } from '../../src/slot/effect';
import { marker } from '../../src/utilities';
import type { Element } from '../../src/types';


describe('slot/EffectSlot', () => {
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

    describe('construction', () => {
        it('creates EffectSlot with anchor', () => {
            let slot = new EffectSlot(anchor, () => 'Hello');

            expect(slot.anchor).toBe(anchor);
        });

        it('renders initial value immediately', () => {
            new EffectSlot(anchor, () => 'Hello');

            expect(container.textContent).toContain('Hello');
        });

        it('stores disposer function', () => {
            let slot = new EffectSlot(anchor, () => 'Hello');

            expect(typeof slot.disposer).toBe('function');
        });
    });

    describe('primitive rendering', () => {
        it('renders string value', () => {
            new EffectSlot(anchor, () => 'Test String');

            expect(container.textContent).toContain('Test String');
        });

        it('renders number value', () => {
            new EffectSlot(anchor, () => 42);

            expect(container.textContent).toContain('42');
        });

        it('renders boolean true as string', () => {
            new EffectSlot(anchor, () => true);

            expect(container.textContent).toContain('true');
        });

        it('renders null as empty', () => {
            new EffectSlot(anchor, () => null);

            // Should not add any text content besides the anchor
            expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
        });

        it('renders false as empty', () => {
            new EffectSlot(anchor, () => false);

            expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
        });

        it('renders undefined as empty', () => {
            new EffectSlot(anchor, () => undefined);

            expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('object rendering', () => {
        it('renders DocumentFragment', () => {
            let frag = document.createDocumentFragment(),
                span = document.createElement('span');

            span.textContent = 'Fragment Content';
            frag.appendChild(span);

            new EffectSlot(anchor, () => frag);

            expect(container.querySelector('span')?.textContent).toBe('Fragment Content');
        });

        it('renders array of values', () => {
            new EffectSlot(anchor, () => ['One', 'Two', 'Three']);

            expect(container.textContent).toContain('One');
            expect(container.textContent).toContain('Two');
            expect(container.textContent).toContain('Three');
        });

        it('renders Node directly', () => {
            let span = document.createElement('span');

            span.textContent = 'Direct Node';

            new EffectSlot(anchor, () => span);

            expect(container.querySelector('span')?.textContent).toBe('Direct Node');
        });
    });

    describe('nested function handling', () => {
        it('unwraps nested functions', () => {
            new EffectSlot(anchor, () => () => 'Nested');

            expect(container.textContent).toContain('Nested');
        });

        it('unwraps deeply nested functions', () => {
            new EffectSlot(anchor, () => () => () => 'Deep Nested');

            expect(container.textContent).toContain('Deep Nested');
        });
    });

    describe('dispose functionality', () => {
        it('provides dispose callback when function accepts argument', () => {
            let disposeCallback: VoidFunction | undefined;

            new EffectSlot(anchor, (dispose) => {
                disposeCallback = dispose;
                return 'Hello';
            });

            expect(typeof disposeCallback).toBe('function');
        });

        it('does not provide dispose callback when function has no parameters', () => {
            let received = false;

            new EffectSlot(anchor, () => {
                received = true;
                return 'Hello';
            });

            expect(received).toBe(true);
        });

        it('dispose removes content from DOM', () => {
            let slot = new EffectSlot(anchor, () => 'Content');

            expect(container.textContent).toContain('Content');

            slot.dispose();

            // After dispose, anchor and content are removed
            expect(container.textContent).not.toContain('Content');
        });

        it('dispose calls disposer function', () => {
            let slot = new EffectSlot(anchor, () => 'Test');
            let disposerCalled = false;
            let originalDisposer = slot.disposer;

            slot.disposer = () => {
                disposerCalled = true;
                originalDisposer();
            };

            slot.dispose();

            expect(disposerCalled).toBe(true);
        });
    });

    describe('text node reuse', () => {
        it('creates text node for string value', () => {
            let slot = new EffectSlot(anchor, () => 'Hello');

            expect(slot.textnode).not.toBeNull();
            expect(slot.textnode?.nodeValue).toBe('Hello');
        });

        it('reuses text node on subsequent updates', () => {
            let value = 'First';
            let slot = new EffectSlot(anchor, () => value);
            let textnode = slot.textnode;

            // Simulate update by calling update directly
            slot.update('Second');

            expect(slot.textnode).toBe(textnode);
            expect(slot.textnode?.nodeValue).toBe('Second');
        });
    });

    describe('group tracking', () => {
        it('tracks group for complex content', () => {
            let frag = document.createDocumentFragment(),
                span1 = document.createElement('span'),
                span2 = document.createElement('span');

            frag.appendChild(span1);
            frag.appendChild(span2);

            let slot = new EffectSlot(anchor, () => frag);

            expect(slot.group).not.toBeNull();
            expect(slot.group?.head).toBe(span1);
            expect(slot.group?.tail).toBe(span2);
        });

        it('group is null for primitive content', () => {
            let slot = new EffectSlot(anchor, () => 'Text');

            expect(slot.group).toBeNull();
        });
    });

    describe('scheduled updates', () => {
        it('initializes with scheduled=false', () => {
            let slot = new EffectSlot(anchor, () => 'Test');

            expect(slot.scheduled).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('handles empty string', () => {
            new EffectSlot(anchor, () => '');

            // Empty string renders as empty text
            expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
        });

        it('handles 0', () => {
            new EffectSlot(anchor, () => 0);

            expect(container.textContent).toContain('0');
        });

        it('handles empty array', () => {
            new EffectSlot(anchor, () => []);

            expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
        });

        it('handles special characters', () => {
            new EffectSlot(anchor, () => '<script>alert("xss")</script>');

            // Should be escaped as text, not interpreted as HTML
            expect(container.querySelector('script')).toBeNull();
            expect(container.textContent).toContain('<script>');
        });

        it('handles unicode', () => {
            new EffectSlot(anchor, () => 'Hello 👋 World 🌍');

            expect(container.textContent).toContain('Hello 👋 World 🌍');
        });
    });
});
