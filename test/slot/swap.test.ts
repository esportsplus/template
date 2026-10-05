import { afterEach, describe, expect, it, vi } from 'vitest';
import { effect, flush, read, root, signal, untrack, write } from '@esportsplus/reactivity';
import { onconnect, ondisconnect } from '../../src/event';
import { sweep } from '../../src/slot/cleanup';
import slot from '../../src/slot';
import { EffectSlot } from '../../src/slot/effect';
import { marker } from '../../src/utilities';
import type { Element } from '../../src/types';

import render from '../../src/render';


let frames: VoidFunction[] = [];

vi.mock('../../src/utilities', async (importOriginal) => {
    let original = await importOriginal<typeof import('../../src/utilities')>();

    return { ...original, raf: (cb: VoidFunction) => { frames.push(cb); } };
});


function anchor(parent: Node) {
    let node = marker.cloneNode() as unknown as Element;

    parent.appendChild(node as unknown as Node);

    return node;
}

function frame() {
    let current = frames;

    frames = [];

    for (let i = 0, n = current.length; i < n; i++) {
        current[i]();
    }
}


// A router swapping pages through an effect slot, each page built in a detached root (no owner), as
// @esportsplus/routing's match() middleware does; pages mount examples lazily through a nested effect slot.
describe('page swap of content built without an owner', () => {
    let host: HTMLElement;

    afterEach(() => {
        for (let i = 0; i < 70; i++) {
            frame();
        }

        host.remove();
    });

    function app(route: ReturnType<typeof signal<string>>, calls: string[], ticks: { n: number }) {
        let mounted = signal(false),
            s = signal(0);

        host = document.createElement('main');
        document.body.appendChild(host);

        render(host, () => () => {
            let name = read(route);

            return root(() => {
                let page = document.createElement('section');

                if (name !== 'editor') {
                    page.textContent = name;

                    return page;
                }

                let wrapper = document.createElement('div'),
                    stage = document.createElement('div');

                // Built first, then inserted through a static slot, as compiled nested templates are
                wrapper.appendChild(stage);
                ondisconnect(wrapper as unknown as Element, () => calls.push('wrapper'));
                new EffectSlot(anchor(stage), () => {
                    if (!read(mounted)) {
                        return '';
                    }

                    return untrack(() => {
                        let editor = document.createElement('div');

                        ondisconnect(editor as unknown as Element, () => calls.push('editor'));
                        onconnect(editor as unknown as Element, () => {
                            effect(() => { ticks.n++; read(s); });
                        });

                        return editor;
                    });
                });
                slot(anchor(page), wrapper);

                return page;
            });
        });

        return { mount: () => write(mounted, true), s };
    }

    it('releases everything a page built, lazily mounted parts included, when the next page replaces it', () => {
        let calls: string[] = [],
            route = signal('editor'),
            ticks = { n: 0 },
            { mount, s } = app(route, calls, ticks);

        mount();
        flush();
        frame();

        expect(host.querySelectorAll('div').length).toBe(3);
        expect(ticks.n).toBe(1);

        write(route, 'accordion');
        flush();

        expect(calls.sort()).toEqual(['editor', 'wrapper']);

        write(s, 1);
        flush();

        expect(ticks.n).toBe(1);
    });

    it('releases a page built after an await, swapped before any sweep', async () => {
        let calls: string[] = [],
            route = signal('async'),
            ticks = 0,
            s = signal(0),
            resolve!: VoidFunction,
            ready = new Promise<void>((r) => { resolve = r; });

        host = document.createElement('main');
        document.body.appendChild(host);

        render(host, () => () => {
            if (read(route) !== 'async') {
                return 'other';
            }

            return root(() => {
                let page = document.createElement('section');

                new EffectSlot(anchor(page), async () => {
                    await ready;

                    let body = document.createElement('article');

                    ondisconnect(body as unknown as Element, () => calls.push('page'));
                    onconnect(body as unknown as Element, () => {
                        effect(() => { ticks++; read(s); });
                    });

                    return body;
                });

                return page;
            });
        });

        resolve();
        await ready;
        await Promise.resolve();
        frame();

        expect(host.querySelector('article')).not.toBeNull();
        expect(ticks).toBe(1);

        write(route, 'other');
        flush();
        write(s, 1);
        flush();

        expect(calls).toEqual(['page']);
        expect(ticks).toBe(1);
    });

    it('releases a cleanup registered with no owner on a connected node removed before any sweep', () => {
        let cleanup = vi.fn(),
            node = document.createElement('div') as unknown as Element;

        host = document.createElement('main');
        document.body.appendChild(host);
        host.appendChild(node as unknown as Node);
        ondisconnect(node, cleanup);
        node.remove();
        sweep();

        expect(cleanup).toHaveBeenCalledTimes(1);
    });
});
