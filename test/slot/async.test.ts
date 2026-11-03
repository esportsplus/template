import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { read, root, signal, write } from '@esportsplus/reactivity';
import { parent } from '../../src/slot/cleanup';
import { EffectSlot } from '../../src/slot/effect';
import { marker } from '../../src/utilities';
import type { Element } from '../../src/types';


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
                expect(container.lastChild?.nodeType).toBe(Node.TEXT_NODE);
                expect(container.lastChild?.nodeValue).toBe('');
            });
        });

        it('renders empty string for false', async () => {
            new EffectSlot(anchor, async () => false);

            await vi.waitFor(() => {
                expect(container.lastChild?.nodeType).toBe(Node.TEXT_NODE);
                expect(container.lastChild?.nodeValue).toBe('');
            });
        });
    });

    describe('disposal', () => {
        it('ignores a resolution that lands after dispose', async () => {
            let resolve: (v: string) => void,
                promise = new Promise<string>((r) => { resolve = r; }),
                slot = new EffectSlot(anchor, async (fallback: any) => {
                    fallback('Loading');
                    return promise;
                });

            await vi.waitFor(() => {
                expect(container.textContent).toContain('Loading');
            });

            slot.dispose();

            expect(container.childNodes.length).toBe(0);

            resolve!('Late');
            await promise;
            await Promise.resolve();

            expect(container.childNodes.length).toBe(0);
        });

        it('ignores fallback and resolution after the owning root is disposed', async () => {
            let dispose = () => {},
                resolve: (v: string) => void,
                promise = new Promise<string>((r) => { resolve = r; }),
                step = () => {};

            root(stop => {
                dispose = stop;

                new EffectSlot(anchor, async (fallback: any) => {
                    await new Promise<void>(r => { step = r; });
                    fallback('Loading');
                    return promise;
                });
            });

            dispose();
            step();
            await Promise.resolve();
            await Promise.resolve();

            expect(container.textContent).toBe('');

            resolve!('Late');
            await promise;
            await Promise.resolve();

            expect(container.textContent).toBe('');
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
        it('renders nothing and reports the error when the async function rejects', async () => {
            let reported: unknown[] = [];

            vi.stubGlobal('reportError', (error: unknown) => reported.push(error));
            new EffectSlot(anchor, async () => {
                throw new Error('async failure');
            });

            await vi.waitFor(() => {
                expect(reported).toHaveLength(1);
            });

            expect((reported[0] as Error).message).toBe('@esportsplus/template: async slot threw');
            expect(((reported[0] as Error).cause as Error).message).toBe('async failure');
            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild).toBe(anchor as unknown as Node);

            vi.unstubAllGlobals();
        });

        it('keeps the fallback shown when the promise rejects', async () => {
            let reported: unknown[] = [];

            vi.stubGlobal('reportError', (error: unknown) => reported.push(error));
            new EffectSlot(anchor, async (fallback: any) => {
                fallback('Fallback shown');
                throw new Error('rejected');
            });

            await vi.waitFor(() => {
                expect(reported).toHaveLength(1);
            });

            expect(container.textContent).toContain('Fallback shown');

            vi.unstubAllGlobals();
        });
    });

    describe('return value handling', () => {
        it('renders undefined as empty string', async () => {
            new EffectSlot(anchor, async () => undefined);

            await vi.waitFor(() => {
                expect(container.lastChild?.nodeType).toBe(Node.TEXT_NODE);
                expect(container.lastChild?.nodeValue).toBe('');
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
        it('releases the async computed with the slot', async () => {
            let runs = 0,
                s = signal(1),
                slot = new EffectSlot(anchor, async () => {
                    runs++;

                    return read(s);
                });

            await vi.waitFor(() => {
                expect(container.textContent).toBe('1');
            });

            slot.release();
            write(s, 2);
            await new Promise((resolve) => setTimeout(resolve));

            expect(runs).toBe(1);
            expect(container.textContent).toBe('1');
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
    describe('re-running', () => {
        it('re-runs when a signal read before the first await changes, and shows only the latest result', async () => {
            let id = signal(1),
                resolvers: ((value: string) => void)[] = [];

            new EffectSlot(anchor, async () => {
                let current = read(id);

                return new Promise<string>((resolve) => {
                    resolvers.push(() => resolve(`user ${current}`));
                });
            });

            write(id, 2);
            await new Promise((resolve) => setTimeout(resolve));

            expect(resolvers).toHaveLength(2);

            resolvers[1]('');
            await vi.waitFor(() => {
                expect(container.textContent).toBe('user 2');
            });

            resolvers[0]('');
            await new Promise((resolve) => setTimeout(resolve));

            expect(container.textContent).toBe('user 2');
        });
    });

    describe('ownership', () => {
        it('is the parent of content built before the first await', async () => {
            let inner: EffectSlot | undefined,
                slot: EffectSlot | undefined;

            new EffectSlot(anchor, () => {
                let host = document.createElement('div'),
                    outer = marker.cloneNode() as unknown as Element;

                host.appendChild(outer as unknown as Node);
                slot = new EffectSlot(outer, async () => {
                    let nested = document.createElement('div'),
                        position = marker.cloneNode() as unknown as Element;

                    nested.appendChild(position as unknown as Node);
                    inner = new EffectSlot(position, () => 'inner');
                    await Promise.resolve();

                    return nested;
                });

                return host;
            });

            await vi.waitFor(() => {
                expect(container.textContent).toBe('inner');
            });

            expect(parent(inner!)).toBe(slot);
        });
    });
});
