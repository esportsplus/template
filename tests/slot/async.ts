import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectSlot } from '../../src/slot/effect';
import { marker } from '../../src/utilities';
import type { Element, Renderable } from '../../src/types';


describe('slot/EffectSlot (async)', () => {
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
            let slot = new EffectSlot(anchor, async () => 'Hello');

            expect(slot.anchor).toBe(anchor);
        });

        it('passes fallback setter to async function', async () => {
            let received = false;

            new EffectSlot(anchor, async (fallback: any) => {
                received = typeof fallback === 'function';
                return 'done';
            });

            await vi.waitFor(() => {
                expect(received).toBe(true);
            });
        });
    });

    describe('fallback rendering', () => {
        it('renders fallback content immediately', async () => {
            let resolve: (v: string) => void;

            let promise = new Promise<string>((r) => { resolve = r; });

            new EffectSlot(anchor, async (fallback: any) => {
                fallback('Loading...');
                return promise;
            });

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Loading...');
            });

            resolve!('Done');

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Done');
                expect(container.textContent).not.toContain('Loading...');
            });
        });

        it('renders fallback as DOM node', async () => {
            let resolve: (v: string) => void;

            let promise = new Promise<string>((r) => { resolve = r; });

            let fallbackNode = document.createElement('span');
            fallbackNode.textContent = 'Spinner';

            new EffectSlot(anchor, async (fallback: any) => {
                fallback(fallbackNode);
                return promise;
            });

            await vi.waitFor(() => {
                expect(container.querySelector('span')?.textContent).toBe('Spinner');
            });

            resolve!('Resolved');

            await vi.waitFor(() => {
                expect(container.querySelector('span')).toBeNull();
                expect(container.textContent).toContain('Resolved');
            });
        });

        it('updates fallback progressively', async () => {
            let resolve: (v: string) => void;

            let promise = new Promise<string>((r) => { resolve = r; });

            new EffectSlot(anchor, async (fallback: any) => {
                fallback('Step 1');

                await Promise.resolve();

                fallback('Step 2');

                return promise;
            });

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Step 2');
                expect(container.textContent).not.toContain('Step 1');
            });

            resolve!('Final');

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Final');
                expect(container.textContent).not.toContain('Step 2');
            });
        });
    });

    describe('async resolution', () => {
        it('renders resolved value as string', async () => {
            new EffectSlot(anchor, async () => 'Hello World');

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Hello World');
            });
        });

        it('renders resolved value as number', async () => {
            new EffectSlot(anchor, async () => 42);

            await vi.waitFor(() => {
                expect(container.textContent).toContain('42');
            });
        });

        it('renders resolved DOM node', async () => {
            let div = document.createElement('div');
            div.textContent = 'Resolved Node';

            new EffectSlot(anchor, async () => div);

            await vi.waitFor(() => {
                expect(container.querySelector('div')?.textContent).toBe('Resolved Node');
            });
        });

        it('renders empty string for null', async () => {
            new EffectSlot(anchor, async () => null);

            await vi.waitFor(() => {
                expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
            });
        });

        it('renders empty string for false', async () => {
            new EffectSlot(anchor, async () => false);

            await vi.waitFor(() => {
                expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe('no fallback', () => {
        it('slot stays empty until resolved', async () => {
            let resolve: (v: string) => void;

            let promise = new Promise<string>((r) => { resolve = r; });

            new EffectSlot(anchor, async () => promise);

            expect(container.textContent).toBe('');

            resolve!('Now Visible');

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Now Visible');
            });
        });
    });

    describe('error handling', () => {
        it('does not crash when async function rejects', async () => {
            new EffectSlot(anchor, async () => {
                throw new Error('async failure');
            });

            await vi.waitFor(() => {
                expect(container.childNodes.length).toBeGreaterThanOrEqual(1);
            });
        });

        it('renders fallback even if promise rejects', async () => {
            new EffectSlot(anchor, async (fallback: any) => {
                fallback('Fallback shown');
                throw new Error('rejected');
            });

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Fallback shown');
            });
        });
    });

    describe('return value handling', () => {
        it('renders undefined as empty string', async () => {
            new EffectSlot(anchor, async () => undefined);

            await vi.waitFor(() => {
                let nodes = container.childNodes;
                let found = false;

                for (let i = 0, n = nodes.length; i < n; i++) {
                    if (nodes[i].nodeType === 3) {
                        found = true;
                    }
                }

                expect(found).toBe(true);
            });
        });

        it('renders function return value recursively', async () => {
            new EffectSlot(anchor, async () => () => 'nested');

            await vi.waitFor(() => {
                expect(container.textContent).toContain('nested');
            });
        });

        it('renders array of DOM nodes', async () => {
            let span1 = document.createElement('span');
            span1.textContent = 'A';

            let span2 = document.createElement('span');
            span2.textContent = 'B';

            new EffectSlot(anchor, async () => [span1, span2]);

            await vi.waitFor(() => {
                let spans = container.querySelectorAll('span');

                expect(spans.length).toBe(2);
                expect(spans[0].textContent).toBe('A');
                expect(spans[1].textContent).toBe('B');
            });
        });

        it('renders array of strings', async () => {
            new EffectSlot(anchor, async () => ['Hello', ' ', 'World']);

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Hello');
                expect(container.textContent).toContain('World');
            });
        });
    });

    describe('disposer behavior', () => {
        it('sets disposer to null for async functions', () => {
            let slot = new EffectSlot(anchor, async () => 'test');

            expect(slot.disposer).toBeNull();
        });

        it('dispose() is a no-op for async slots', () => {
            let slot = new EffectSlot(anchor, async () => 'test');

            expect(() => slot.dispose()).not.toThrow();
        });
    });

    describe('fallback to resolution race', () => {
        it('resolution replaces fallback even when both are DOM nodes', async () => {
            let resolve: (v: Node) => void;

            let promise = new Promise<Node>((r) => { resolve = r; });

            let fallbackSpan = document.createElement('span');
            fallbackSpan.className = 'fallback';
            fallbackSpan.textContent = 'Loading';

            let resolvedDiv = document.createElement('div');
            resolvedDiv.className = 'resolved';
            resolvedDiv.textContent = 'Done';

            new EffectSlot(anchor, async (fallback: any) => {
                fallback(fallbackSpan);
                return promise;
            });

            await vi.waitFor(() => {
                expect(container.querySelector('.fallback')).not.toBeNull();
            });

            resolve!(resolvedDiv);

            await vi.waitFor(() => {
                expect(container.querySelector('.fallback')).toBeNull();
                expect(container.querySelector('.resolved')?.textContent).toBe('Done');
            });
        });

        it('resolution replaces fallback when fallback is text and resolution is text', async () => {
            let resolve: (v: string) => void;

            let promise = new Promise<string>((r) => { resolve = r; });

            new EffectSlot(anchor, async (fallback: any) => {
                fallback('Loading...');
                return promise;
            });

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Loading...');
            });

            resolve!('Complete');

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Complete');
                expect(container.textContent).not.toContain('Loading...');
            });
        });

        it('handles immediate resolution without fallback', async () => {
            new EffectSlot(anchor, async () => {
                return 'Instant';
            });

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Instant');
            });
        });
    });

    describe('cleanup', () => {
        it('removes previous fallback group when updating', async () => {
            let resolve: (v: string) => void;

            let promise = new Promise<string>((r) => { resolve = r; });

            let span1 = document.createElement('span');
            span1.className = 'fallback';
            span1.textContent = 'Loading';

            new EffectSlot(anchor, async (fallback: any) => {
                fallback(span1);
                return promise;
            });

            await vi.waitFor(() => {
                expect(container.querySelector('.fallback')).not.toBeNull();
            });

            resolve!('Done');

            await vi.waitFor(() => {
                expect(container.querySelector('.fallback')).toBeNull();
                expect(container.textContent).toContain('Done');
            });
        });

        it('removes previous textnode when updating to DOM node', async () => {
            let resolve: (v: Node) => void;

            let promise = new Promise<Node>((r) => { resolve = r; });

            new EffectSlot(anchor, async (fallback: any) => {
                fallback('text fallback');
                return promise;
            });

            await vi.waitFor(() => {
                expect(container.textContent).toContain('text fallback');
            });

            let div = document.createElement('div');
            div.textContent = 'replaced';
            resolve!(div);

            await vi.waitFor(() => {
                expect(container.textContent).not.toContain('text fallback');
                expect(container.querySelector('div')?.textContent).toBe('replaced');
            });
        });
    });
});
