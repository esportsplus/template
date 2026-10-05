import { afterEach, describe, expect, it, vi } from 'vitest';
import { flush, reactive, read, root, signal, write } from '@esportsplus/reactivity';
import { setProperty } from '../../src/attributes';
import { CLEANUP } from '../../src/constants';
import { delegate, onactive, ondisconnect as hook, ondocument, onfirstpaint, onwindow } from '../../src/event';
import { ArraySlot } from '../../src/slot/array';
import { enter, exit, ondisconnect, sweep, track } from '../../src/slot/cleanup';
import type { Slot } from '../../src/slot/cleanup';
import { EffectSlot } from '../../src/slot/effect';
import { marker } from '../../src/utilities';
import type { Element } from '../../src/types';

import render from '../../src/render';


function anchor(parent: Node) {
    let node = marker.cloneNode() as unknown as Element;

    parent.appendChild(node as unknown as Node);

    return node;
}

function element(tag: string = 'div', parent: Node | null = null) {
    let node = document.createElement(tag) as unknown as Element;

    parent?.appendChild(node as unknown as Node);

    return node;
}

function host() {
    return element('section', document.body);
}

// A slot whose anchor reads are counted, to see which sweeps visit it
function probe(connected: () => boolean) {
    let reads = 0,
        slot: Slot = {
            get anchor() {
                reads++;
                return { isConnected: connected() } as Node;
            },
            disposed: false,
            parent: null,
            release: vi.fn(),
            state: 0
        };

    return { reads: () => reads, slot };
}

function tick() {
    return new Promise<void>(resolve => queueMicrotask(resolve));
}

// Runs 'fn' as a slot's content is built: inside a root, with a slot to parent what it creates
function within(fn: () => void) {
    return root((dispose) => {
        let slot: Slot = { anchor: document.body, disposed: false, parent: null, release: dispose, state: 0 },
            parent = enter(slot);

        try {
            fn();
        }
        finally {
            exit(parent);
        }

        return dispose;
    });
}


describe('slot/cleanup sweep scheduling', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts lazily, repeats while anything is tracked and stops once nothing is', () => {
        vi.useFakeTimers();

        expect(vi.getTimerCount()).toBe(0);

        let parent = host(),
            released = vi.fn();

        render(parent, { ondisconnect: released }, () => 'content');

        expect(vi.getTimerCount()).toBe(1);

        // The cadence timer, then the idle slice it requests
        vi.runOnlyPendingTimers();
        vi.runOnlyPendingTimers();
        parent.remove();

        expect(released).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(1);

        vi.runOnlyPendingTimers();
        vi.runOnlyPendingTimers();

        expect(released).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('slot/cleanup sweep', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('tracks a slot once however often it is tracked', () => {
        let { reads, slot } = probe(() => true);

        for (let i = 0; i < 5; i++) {
            track(slot);
        }

        sweep();

        expect(reads()).toBe(1);

        slot.disposed = true;
        sweep();
        sweep();

        expect(reads()).toBe(1);
    });

    it('stops tracking a slot never mounted after 60 sweeps without releasing it', () => {
        let { reads, slot } = probe(() => false);

        track(slot);

        for (let i = 0; i < 70; i++) {
            sweep();
        }

        expect(reads()).toBe(61);
        expect(slot.release).not.toHaveBeenCalled();
    });

    it('releases a mounted slot found out of the document once, then forgets it', () => {
        let connected = true,
            { reads, slot } = probe(() => connected);

        track(slot);
        sweep();
        connected = false;
        sweep();
        sweep();

        expect(slot.release).toHaveBeenCalledTimes(1);
        expect(slot.disposed).toBe(true);
        expect(reads()).toBe(3);
    });

    it('resumes across idle slices, keeps slots tracked mid-pass, and compacts correctly', () => {
        let deadline = { didTimeout: true, timeRemaining: () => 0 } as IdleDeadline,
            parent = host(),
            released: ReturnType<typeof vi.fn>[] = [],
            stops: VoidFunction[] = [];

        for (let i = 0; i < 600; i++) {
            let fn = vi.fn(),
                stop = render(element('div', parent) as unknown as HTMLElement, { ondisconnect: fn }, () => 'x');

            released.push(fn);
            stops.push(stop);
        }

        // Released by their owner while still in the document: dropped on their next visit
        for (let i = 1; i < 600; i += 2) {
            stops[i]();
        }

        sweep(deadline);

        let late = vi.fn();

        render(element('div', parent) as unknown as HTMLElement, { ondisconnect: late }, () => 'x');

        for (let i = 0; i < 10; i++) {
            sweep(deadline);
        }

        parent.remove();
        sweep();

        for (let i = 0, n = released.length; i < n; i++) {
            expect(released[i]).toHaveBeenCalledTimes(1);
        }

        expect(late).toHaveBeenCalledTimes(1);
    });

    it('frees an effect slot foreign code removed though nothing it reads changes', () => {
        let parent = host(),
            runs = 0,
            s = signal(0),
            slot = new EffectSlot(anchor(element('div', parent)), () => { runs++; return read(s); });

        sweep();
        parent.remove();
        sweep();

        expect(slot.disposed).toBe(true);

        write(s, 1);
        flush();

        expect(runs).toBe(1);
    });

    it('releases a nested effect slot with its render() root, though it never reruns', () => {
        let disconnected = vi.fn(),
            parent = host(),
            runs = 0,
            s = signal(0),
            slot: EffectSlot | null = null;

        render(parent, () => {
            let node = element();

            hook(node, disconnected);
            slot = new EffectSlot(anchor(node), () => { runs++; return read(s); });

            return node as unknown as Node;
        });
        flush();

        expect(slot!.parent).not.toBeNull();

        sweep();
        parent.remove();
        sweep();

        expect(slot!.disposed).toBe(true);
        expect(disconnected).toHaveBeenCalledTimes(1);

        write(s, 1);
        flush();

        expect(runs).toBe(1);
    });

    it('does not track slots created while another slot is being built', () => {
        let reads = 0,
            nested: Slot = {
                get anchor() {
                    reads++;
                    return document.body;
                },
                disposed: false,
                parent: { anchor: document.body, disposed: false, parent: null, release: () => {}, state: 0 },
                release: vi.fn(),
                state: 0
            };

        track(nested);
        sweep();

        expect(reads).toBe(0);
    });

    it('frees the reactive attributes of a render root whose parent foreign code removed', () => {
        let parent = host(),
            runs = 0,
            s = signal('a');

        render(parent, { title: () => { runs++; return read(s); } }, () => () => read(s));
        sweep();
        parent.remove();
        sweep();
        write(s, 'b');
        flush();

        expect(runs).toBe(1);
        expect(parent.title).toBe('a');
        expect(parent.textContent).toBe('a');
    });

    it('releases onfirstpaint, onactive, ondisconnect and listeners with the slot that owned them', () => {
        let parent = host(),
            clicks = 0,
            disconnected = vi.fn(),
            painted = vi.fn(),
            target: Element | null = null,
            wheels = 0;

        render(parent, () => {
            let node = target = element();

            delegate(node, 'click', () => { clicks++; });
            onactive(node, 'wheel', () => { wheels++; });
            onfirstpaint(node, painted);
            hook(node, disconnected);

            return node as unknown as Node;
        });

        sweep();
        parent.remove();
        sweep();

        expect(disconnected).toHaveBeenCalledWith(target);

        document.body.appendChild(parent);
        target!.click();
        target!.dispatchEvent(new Event('pointermove'));
        target!.dispatchEvent(new Event('wheel'));

        expect(clicks).toBe(0);
        expect(wheels).toBe(0);

        parent.remove();
    });

    it('reports cleanup errors with the package prefix instead of throwing', async () => {
        let boom = new Error('boom'),
            fine = vi.fn(),
            parent = host(),
            report = vi.fn();

        vi.stubGlobal('reportError', report);

        try {
            render(parent, () => {
                let a = element(),
                    b = element();

                hook(a, () => { throw boom; });
                hook(b, fine);

                return [a, b] as unknown as Node[];
            });
            sweep();
            parent.remove();

            expect(() => sweep()).not.toThrow();
            expect(fine).toHaveBeenCalledTimes(1);
            expect(report).toHaveBeenCalledTimes(1);
            expect(report.mock.calls[0][0].message).toMatch(/^@esportsplus\/template: /);
            expect(report.mock.calls[0][0].cause).toBe(boom);

            let other = host();

            render(other, () => {
                let node = element();

                onwindow(node, 'failing', () => {});
                hook(node, () => { throw boom; });

                return node as unknown as Node;
            });
            window.dispatchEvent(new Event('failing'));
            other.remove();
            window.dispatchEvent(new Event('failing'));
            await tick();

            expect(report).toHaveBeenCalledTimes(2);
        }
        finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('slot/cleanup heal', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('releases a removed container of 10k window bindings with one dispose and no walk', async () => {
        let calls = 0,
            parent = host(),
            released = 0,
            remove = vi.spyOn(window, 'removeEventListener');

        render(parent, () => {
            let nodes: Element[] = [];

            ondisconnect(parent, () => { released++; });

            for (let i = 0; i < 10000; i++) {
                let node = element('span');

                onwindow(node, 'storm', () => { calls++; });
                nodes.push(node);
            }

            return nodes as unknown as Node[];
        });

        window.dispatchEvent(new Event('storm'));

        expect(calls).toBe(10000);

        parent.remove();

        let walker = vi.spyOn(document, 'createTreeWalker');

        window.dispatchEvent(new Event('storm'));

        expect(calls).toBe(10000);

        await tick();

        expect(released).toBe(1);
        expect(walker).not.toHaveBeenCalled();
        expect(remove.mock.calls.filter(([name]) => name === 'storm')).toHaveLength(1);

        document.body.appendChild(parent);
        window.dispatchEvent(new Event('storm'));

        expect(calls).toBe(10000);

        parent.remove();
    });

    it('releases a removed container of effects once however many trip on it', async () => {
        let parent = host(),
            released = 0,
            runs = 0,
            s = signal(0);

        render(parent, () => {
            let nodes: Element[] = [];

            ondisconnect(parent, () => { released++; });

            for (let i = 0; i < 50; i++) {
                let node = element();

                new EffectSlot(anchor(node), () => { runs++; return read(s); });
                nodes.push(node);
            }

            return nodes as unknown as Node[];
        });

        // Effects created inside a run start on the next pass
        flush();
        write(s, 1);
        flush();

        expect(runs).toBe(100);

        parent.remove();
        write(s, 2);
        flush();
        await tick();

        expect(runs).toBe(100);
        expect(released).toBe(1);

        write(s, 3);
        flush();

        expect(runs).toBe(100);
    });

    it('reaches into a shadow root whose host foreign code removed', async () => {
        let count = 0,
            disconnected = vi.fn(),
            parent = host(),
            shadow = element('div', parent),
            inner = element('div', (shadow as unknown as HTMLElement).attachShadow({ mode: 'open' }));

        render(inner as unknown as HTMLElement, () => {
            let node = element();

            hook(node, disconnected);
            onwindow(node, 'shadow', () => { count++; });

            return node as unknown as Node;
        });

        window.dispatchEvent(new Event('shadow'));
        parent.remove();
        window.dispatchEvent(new Event('shadow'));
        await tick();

        expect(count).toBe(1);
        expect(disconnected).toHaveBeenCalledTimes(1);
    });

    it('releases a shadow-root effect found by the sweep', () => {
        let parent = host(),
            runs = 0,
            s = signal(0),
            shadow = (element('div', parent) as unknown as HTMLElement).attachShadow({ mode: 'open' }),
            slot = new EffectSlot(anchor(element('div', shadow)), () => { runs++; return read(s); });

        sweep();
        parent.remove();
        sweep();
        write(s, 1);
        flush();

        expect(slot.disposed).toBe(true);
        expect(runs).toBe(1);
    });

    it('climbs only as far as the slots foreign code took out', async () => {
        let outer = vi.fn(),
            parent = host(),
            row: Element | null = null,
            rowReleased = vi.fn(),
            s = signal('a');

        render(parent, () => {
            let list = element('ul');

            hook(list, outer);
            row = element('li', list);
            new EffectSlot(anchor(row), () => {
                hook(row!, rowReleased);
                return read(s);
            });

            return list as unknown as Node;
        });

        row!.remove();
        write(s, 'b');
        flush();
        await tick();

        expect(rowReleased).toHaveBeenCalledTimes(1);
        expect(outer).not.toHaveBeenCalled();

        parent.remove();
    });
});

describe('foreign removal', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each<'document' | 'window'>(['document', 'window'])('%s handler stops and its registration is dropped once the owner is removed', async mode => {
        let count = 0,
            disconnected = vi.fn(),
            parent = host(),
            target = mode === 'document' ? document : window,
            release = vi.spyOn(target, 'removeEventListener'),
            trigger = () => target.dispatchEvent(new Event('foreign'));

        render(parent, () => {
            let node = element('button');

            hook(node, disconnected);
            (mode === 'document' ? ondocument : onwindow)(node, 'foreign', () => { count++; });

            return node as unknown as Node;
        });

        trigger();

        expect(count).toBe(1);

        parent.remove();
        trigger();

        expect(count).toBe(1);

        await tick();

        expect(release).toHaveBeenCalledWith('foreign', expect.any(Function));
        expect(disconnected).toHaveBeenCalledTimes(1);

        document.body.append(parent);
        trigger();

        expect(count).toBe(1);

        parent.remove();
    });

    it('keeps a handler whose owner is moved within the task', async () => {
        let count = 0,
            other = host(),
            parent = host(),
            trigger = () => window.dispatchEvent(new Event('moved'));

        render(parent, () => {
            let node = element('button');

            onwindow(node, 'moved', () => { count++; });

            return node as unknown as Node;
        });

        trigger();
        parent.remove();
        trigger();
        other.append(parent);

        await tick();
        sweep();
        trigger();

        expect(count).toBe(2);

        other.remove();
    });

    it('skips an owner that was never mounted without releasing it', async () => {
        let count = 0,
            disconnected = vi.fn(),
            parent = element(),
            trigger = () => window.dispatchEvent(new Event('unmounted'));

        render(parent as unknown as HTMLElement, () => {
            let node = element('button');

            hook(node, disconnected);
            onwindow(node, 'unmounted', () => { count++; });

            return node as unknown as Node;
        });

        trigger();
        await tick();
        sweep();

        expect(count).toBe(0);
        expect(disconnected).not.toHaveBeenCalled();

        document.body.append(parent as unknown as Node);
        trigger();

        expect(count).toBe(1);

        parent.remove();
    });

    it('stops an effect slot instead of rerunning once its mounted anchor is removed', async () => {
        let cleanup = vi.fn(),
            parent = host(),
            runs = 0,
            s = signal('a');

        new EffectSlot(anchor(parent), () => {
            runs++;

            let span = element('span');

            span.textContent = read(s);
            hook(span, cleanup);

            return span as unknown as Node;
        });

        write(s, 'b');
        flush();

        expect(runs).toBe(2);
        expect(cleanup).toHaveBeenCalledTimes(1);

        parent.remove();
        write(s, 'c');
        flush();

        expect(runs).toBe(2);
        expect(parent.textContent).toBe('b');
        expect(cleanup).toHaveBeenCalledTimes(2);

        await tick();
        document.body.appendChild(parent);
        write(s, 'd');
        flush();

        expect(runs).toBe(2);

        parent.remove();
    });

    it('keeps an effect slot rendering when moved within the task, even if it reran while out', async () => {
        let other = host(),
            parent = host(),
            s = signal('a');

        new EffectSlot(anchor(parent), () => read(s));

        write(s, 'b');
        flush();
        parent.remove();
        write(s, 'c');
        flush();
        other.appendChild(parent);

        expect(parent.textContent).toBe('b');

        await tick();
        flush();

        expect(parent.textContent).toBe('c');

        write(s, 'd');
        flush();

        expect(parent.textContent).toBe('d');

        other.remove();
    });

    it('renders into content that was never mounted', () => {
        let detached = element(),
            s = signal('a');

        new EffectSlot(anchor(detached), () => read(s));
        sweep();
        write(s, 'b');
        flush();

        expect(detached.textContent).toBe('b');

        document.body.appendChild(detached as unknown as Node);
        write(s, 'c');
        flush();

        expect(detached.textContent).toBe('c');

        detached.remove();
    });

    it('stops a reactive attribute instead of rerunning once its mounted element is removed', async () => {
        let node = element('div', host()),
            runs = 0,
            s = signal('a');

        root(() => setProperty(node, 'title', () => { runs++; return read(s); }));
        write(s, 'b');
        flush();
        node.remove();
        write(s, 'c');
        flush();
        await tick();

        expect(runs).toBe(2);
        expect(node.title).toBe('b');

        document.body.appendChild(node as unknown as Node);
        write(s, 'd');
        flush();

        expect(runs).toBe(2);

        node.remove();
    });

    it('keeps a reactive attribute writing when moved within the task', async () => {
        let other = host(),
            node = element('div', host()),
            s = signal('a');

        setProperty(node, 'title', () => read(s));
        write(s, 'b');
        flush();
        node.remove();
        write(s, 'c');
        flush();
        other.appendChild(node as unknown as Node);
        await tick();
        flush();

        expect(node.title).toBe('c');

        other.remove();
    });

    it('keeps writing to an element that was never mounted', () => {
        let node = element(),
            s = signal('a');

        setProperty(node, 'title', () => read(s));
        sweep();
        write(s, 'b');
        flush();

        expect(node.title).toBe('b');
    });

    it('releases an array row foreign code removed and leaves its siblings', async () => {
        let parent = host(),
            released: number[] = [],
            rows = reactive([1, 2, 3]),
            s = signal(0),
            slot = new ArraySlot(rows, (n: number) => {
                let li = element('li'),
                    fragment = document.createDocumentFragment();

                hook(li, () => released.push(n));
                new EffectSlot(anchor(li), () => read(s));
                fragment.appendChild(li as unknown as Node);

                return fragment;
            });

        parent.appendChild(slot.fragment);
        write(s, 1);
        flush();
        parent.children[1].remove();
        write(s, 2);
        flush();
        await tick();

        expect(released).toEqual([2]);

        rows.splice(1, 1);
        slot.flush();

        expect(released).toEqual([2]);
        expect(parent.textContent).toBe('22');

        parent.remove();
    });
});

describe('ownership', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('cascades from an array row into nested slots and effects without walking the DOM', () => {
        let parent = host(),
            nested: number[] = [],
            rows = reactive([1, 2]),
            runs = 0,
            s = signal(0),
            slot = new ArraySlot(rows, (n: number) => {
                let li = element('li'),
                    fragment = document.createDocumentFragment(),
                    inner = reactive([n * 10]);

                li.appendChild(new ArraySlot(inner, (m: number) => {
                    let span = element('span'),
                        f = document.createDocumentFragment();

                    hook(span, () => nested.push(m));
                    f.appendChild(span as unknown as Node);

                    return f;
                }).fragment);
                new EffectSlot(anchor(li), () => { runs++; return read(s); });
                setProperty(li, 'title', () => { runs++; return String(read(s)); });
                fragment.appendChild(li as unknown as Node);

                return fragment;
            });

        parent.appendChild(slot.fragment);

        let walker = vi.spyOn(document, 'createTreeWalker');

        rows.shift();
        slot.flush();
        write(s, 1);
        flush();

        expect(nested).toEqual([10]);
        expect(runs).toBe(6);
        expect(walker).not.toHaveBeenCalled();

        parent.remove();
    });

    it('adopts content built outside any owner into the render() root that mounts it', () => {
        let parent = host(),
            calls: string[] = [],
            content = element(),
            s = signal('a');

        hook(content, () => calls.push('hook'));
        setProperty(content, 'title', () => read(s));
        onwindow(content, 'adopted', () => calls.push('window'));

        let stop = render(parent, () => content as unknown as Node);

        expect(content[CLEANUP]).toBeUndefined();

        window.dispatchEvent(new Event('adopted'));
        stop();
        window.dispatchEvent(new Event('adopted'));
        write(s, 'b');
        flush();

        expect(calls).toEqual(['window', 'hook']);
        expect(content.title).toBe('a');

        parent.remove();
    });

    it('adopts async content into the slot and releases it when replaced', async () => {
        let parent = host(),
            calls: string[] = [],
            resolve!: (value: Node) => void;

        new EffectSlot(anchor(parent), async (fallback: (content: unknown) => void) => {
            let loading = element('span');

            hook(loading, () => calls.push('loading'));
            fallback(loading);

            return new Promise<Node>(r => { resolve = r; });
        });

        expect(calls).toEqual([]);

        let done = element('b');

        hook(done, () => calls.push('done'));
        resolve(done as unknown as Node);
        await tick();
        await tick();

        expect(calls).toEqual(['loading']);
        expect(parent.textContent).toBe('');
        expect(parent.querySelector('b')).not.toBeNull();

        parent.remove();
    });

    it('keeps the hooks of a node a rerun returns again, and leaves it in place', () => {
        let clicks = 0,
            panel = element('button'),
            parent = host(),
            released = vi.fn(),
            s = signal(0);

        // Built by the owner around the slot, as a component body builds what its effects show
        within(() => {
            delegate(panel, 'click', () => { clicks++; });
            hook(panel, released);
            new EffectSlot(anchor(parent), () => {
                read(s);
                return panel as unknown as Node;
            });
        });

        write(s, 1);
        flush();
        write(s, 2);
        flush();

        expect(parent.lastChild).toBe(panel);
        expect(released).not.toHaveBeenCalled();

        panel.click();

        expect(clicks).toBe(1);

        parent.remove();
    });

    it('updates text in place without releasing what the slot does not own', () => {
        let parent = host(),
            released = vi.fn(),
            s = signal('a');

        render(parent, () => {
            hook(parent, released);

            return new EffectSlot(anchor(element('p', parent)), () => read(s)) && '';
        });

        let text = parent.querySelector('p')!.lastChild;

        write(s, 'b');
        flush();

        expect(parent.querySelector('p')!.lastChild).toBe(text);
        expect(text!.nodeValue).toBe('b');
        expect(released).not.toHaveBeenCalled();

        parent.remove();
    });

    it('releases what a run built when the next run replaces it, in registration order', () => {
        let calls: string[] = [],
            parent = host(),
            s = signal(0);

        new EffectSlot(anchor(parent), () => {
            let n = read(s),
                node = element();

            hook(node, () => calls.push('first ' + n));
            hook(node, () => calls.push('second ' + n));

            return node as unknown as Node;
        });

        write(s, 1);
        flush();

        expect(calls).toEqual(['first 0', 'second 0']);

        parent.remove();
    });

    it('stops a slot disposed during its first run', () => {
        let parent = host(),
            runs = 0,
            s = signal(0);

        new EffectSlot(anchor(parent), (dispose: VoidFunction) => {
            runs++;
            read(s);
            dispose();

            return 'x';
        });

        write(s, 1);
        flush();

        expect(runs).toBe(1);

        parent.remove();
    });
});
