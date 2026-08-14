import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { read, signal, write } from '@esportsplus/reactivity';
import { ANCHOR_LAST, ANCHOR_SOLE } from '../../src/constants';
import { ondisconnect } from '../../src/slot/cleanup';
import { EffectSlot } from '../../src/slot/effect';
import { marker } from '../../src/utilities';
import type { Element } from '../../src/types';


describe('slot/EffectSlot', () => {
    let anchor: Element,
        container: HTMLElement;

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

            expect(container.textContent).toBe('');
        });

        it('renders false as empty', () => {
            new EffectSlot(anchor, () => false);

            expect(container.textContent).toBe('');
        });

        it('renders undefined as empty', () => {
            new EffectSlot(anchor, () => undefined);

            expect(container.textContent).toBe('');
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

    describe('RAF scheduled updates', () => {
        it('batches subsequent reactive updates via RAF', async () => {
            let s = signal('first');

            new EffectSlot(anchor, () => read(s));

            expect(container.textContent).toContain('first');

            write(s, 'second');

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(container.textContent).toContain('second');
        });

        it('coalesces rapid reactive updates into one RAF', async () => {
            let s = signal('a');

            new EffectSlot(anchor, () => read(s));

            expect(container.textContent).toContain('a');

            write(s, 'b');
            write(s, 'c');
            write(s, 'd');

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(container.textContent).toContain('d');
            expect(container.textContent).not.toContain('b');
        });
    });

    describe('dispose with group content', () => {
        it('dispose with group (complex content) removes group nodes', () => {
            let frag = document.createDocumentFragment(),
                span1 = document.createElement('span'),
                span2 = document.createElement('span');

            span1.textContent = 'A';
            span2.textContent = 'B';
            frag.appendChild(span1);
            frag.appendChild(span2);

            let slot = new EffectSlot(anchor, (dispose) => frag);

            expect(container.querySelector('span')).not.toBeNull();
            expect(slot.group).not.toBeNull();
            expect(slot.textnode).toBeNull();

            slot.dispose();

            expect(container.querySelectorAll('span').length).toBe(0);
        });

        it('dispose with textnode removes text and anchor', () => {
            let slot = new EffectSlot(anchor, (dispose) => 'Hello text');

            expect(container.textContent).toContain('Hello text');
            expect(slot.textnode).not.toBeNull();

            slot.dispose();

            expect(container.textContent).not.toContain('Hello text');
        });
    });

    describe('textnode reconnection', () => {
        it('reattaches disconnected textnode on update', () => {
            let slot = new EffectSlot(anchor, () => 'Hello');

            expect(slot.textnode?.isConnected).toBe(true);

            slot.textnode!.parentNode!.removeChild(slot.textnode!);

            expect(slot.textnode?.isConnected).toBe(false);

            slot.update('Updated');

            expect(slot.textnode?.isConnected).toBe(true);
            expect(slot.textnode?.nodeValue).toBe('Updated');
        });
    });

    describe('edge cases', () => {
        it('handles empty string', () => {
            new EffectSlot(anchor, () => '');

            expect(container.textContent).toBe('');
        });

        it('handles 0', () => {
            new EffectSlot(anchor, () => 0);

            expect(container.textContent).toContain('0');
        });

        it('handles empty array', () => {
            new EffectSlot(anchor, () => []);

            expect(container.textContent).toBe('');
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

    describe('parent-anchor mode', () => {
        let parent: Element;

        beforeEach(() => {
            parent = document.createElement('div') as unknown as Element;
            document.body.appendChild(parent as unknown as Node);
        });

        afterEach(() => {
            document.body.removeChild(parent as unknown as Node);
        });

        it('renders text as a child of the parent (sole)', () => {
            new EffectSlot(parent, () => 'Hello', ANCHOR_SOLE);

            expect(parent.textContent).toBe('Hello');
            expect(parent.firstChild?.nodeType).toBe(Node.TEXT_NODE);
        });

        it('appends text after existing static children (last)', () => {
            let span = document.createElement('span');

            span.textContent = 'static';
            parent.appendChild(span);

            new EffectSlot(parent, () => 'tail', ANCHOR_LAST);

            expect(parent.childNodes.length).toBe(2);
            expect(parent.firstChild).toBe(span);
            expect(parent.lastChild?.nodeValue).toBe('tail');
        });

        it('swaps text -> fragment -> text without removing the parent', () => {
            let slot = new EffectSlot(parent, () => 'first', ANCHOR_SOLE);

            expect(parent.textContent).toBe('first');

            let a = document.createElement('a'),
                frag = document.createDocumentFragment();

            a.textContent = 'frag';
            frag.appendChild(a);

            slot.update(frag);

            expect(parent.querySelector('a')?.textContent).toBe('frag');
            expect(parent.textContent).toBe('frag');

            slot.update('third');

            expect(parent.querySelector('a')).toBeNull();
            expect(parent.textContent).toBe('third');
            expect(parent.isConnected).toBe(true);
        });

        it('dispose fires ondisconnect cleanup and never removes the parent', () => {
            let cleaned = false,
                frag = document.createDocumentFragment(),
                span = document.createElement('span');

            span.textContent = 'x';
            frag.appendChild(span);
            ondisconnect(span as unknown as Element, () => { cleaned = true; });

            let slot = new EffectSlot(parent, () => frag, ANCHOR_SOLE);

            expect(parent.querySelector('span')).not.toBeNull();

            slot.dispose();

            expect(cleaned).toBe(true);
            expect(parent.querySelector('span')).toBeNull();
            expect(parent.isConnected).toBe(true);
            expect(document.body.contains(parent as unknown as Node)).toBe(true);
        });

        it('dispose clears the tracked span but keeps preceding siblings (last)', () => {
            let span = document.createElement('span');

            span.textContent = 'keep';
            parent.appendChild(span);

            let slot = new EffectSlot(parent, () => 'gone', ANCHOR_LAST);

            expect(parent.textContent).toBe('keepgone');

            slot.dispose();

            expect(parent.textContent).toBe('keep');
            expect(parent.firstChild).toBe(span);
            expect(parent.isConnected).toBe(true);
        });

        it('reuses the text node across reactive updates', async () => {
            let s = signal('a'),
                slot = new EffectSlot(parent, () => read(s), ANCHOR_SOLE),
                textnode = slot.textnode;

            expect(parent.textContent).toBe('a');

            write(s, 'b');

            await new Promise(resolve => requestAnimationFrame(resolve));

            expect(slot.textnode).toBe(textnode);
            expect(parent.textContent).toBe('b');
        });
    });
});
