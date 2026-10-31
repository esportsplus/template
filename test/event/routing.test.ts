import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stripTypeScriptTypes } from 'node:module';
import { languageService } from '@esportsplus/typescript/compiler';
import { root } from '@esportsplus/reactivity';
import { DIRECT_ATTACH_EVENTS, PASSIVE_EVENTS } from '../../src/constants';
import type { Element } from '../../src/types';


type Host = 'document' | 'element' | 'window';

type Native = [host: Host | 'other', event: string, options: unknown];

type Path = 'attribute' | 'runtime' | 'spread';


let callbacks: VoidFunction[] = [];

vi.mock('../../src/utilities', async (importOriginal) => {
    let original = await importOriginal<typeof import('../../src/utilities')>();

    return {
        ...original,
        raf: (cb: VoidFunction) => { callbacks.push(cb); }
    };
});


let namespace = await import('../../src'),
    { generateCode } = await import('../../src/compiler/codegen'),
    { findTemplateArtifacts } = await import('../../src/compiler/ts-parser'),
    { NAMESPACE } = await import('../../src/compiler/constants'),
    { on, runtime } = await import('../../src/event'),
    { setProperties } = await import('../../src/attributes');


// Every key shape, with where its single native listener lands and for which event
const KEYS: [key: string, host: Host, event: string][] = [
    ['onclick', 'document', 'click'],
    ['onClick', 'document', 'click'],
    ['onceclick', 'document', 'click'],
    ['onCeClick', 'document', 'click'],
    ['onkeydown', 'document', 'keydown'],
    ['ontouchstart', 'document', 'touchstart'],
    ['onwheel', 'document', 'wheel'],
    ['onwaiting', 'element', 'waiting'],
    ['ondomcontentloaded', 'document', 'domcontentloaded'],
    ['onDOMContentLoaded', 'document', 'domcontentloaded'],
    ['oncustom', 'document', 'custom'],
    ['ondocked', 'document', 'docked'],
    ['onwiggle', 'document', 'wiggle'],
    ['onfocus', 'element', 'focus'],
    ['oncefocus', 'element', 'focus'],
    ['onscroll', 'element', 'scroll'],
    ['onsubmit', 'element', 'submit'],
    ['oncancel', 'element', 'cancel'],
    ['onmouseenter', 'element', 'mouseenter'],
    ['ondurationchange', 'element', 'durationchange'],
    ['ondocumentkeydown', 'document', 'keydown'],
    ['onDocumentKeyDown', 'document', 'keydown'],
    ['oncedocumentkeydown', 'document', 'keydown'],
    ['ondocumentfocus', 'document', 'focus'],
    ['ondocumentwheel', 'document', 'wheel'],
    ['onwindowresize', 'window', 'resize'],
    ['onWindowResize', 'window', 'resize'],
    ['oncewindowload', 'window', 'load'],
    ['onwindowscroll', 'window', 'scroll'],
    ['onwindowtouchmove', 'window', 'touchmove']
];

const PATHS: Path[] = ['attribute', 'runtime', 'spread'];

const PASSIVE = new Set<string>(PASSIVE_EVENTS);


function bind(path: Path, key: string, listener: Function): Element {
    if (path === 'runtime') {
        let element = document.createElement('div') as unknown as Element;

        setProperties(element, { [key]: listener });

        return element;
    }

    let fragment = compile(
            path === 'attribute' ? 'let value = html`<div ' + key + '=${listener}></div>`;' : 'let value = html`<div ${{ ' + key + ': listener }}></div>`;',
            { listener }
        ).value as DocumentFragment;

    return fragment.firstChild as unknown as Element;
}

function compile(source: string, args: Record<string, unknown> = {}) {
    let sourceFile = languageService.parse(process.cwd() + '/routing-fixture.ts', source),
        result = generateCode(findTemplateArtifacts(sourceFile), sourceFile),
        output = source;

    for (let replacement of [...result.replacements].sort((a, b) => b.node.getStart(sourceFile) - a.node.getStart(sourceFile))) {
        output = output.slice(0, replacement.node.getStart(sourceFile)) + replacement.generate(sourceFile) + output.slice(replacement.node.end);
    }

    output = result.prepend.join('\n') + '\n' + output;

    return {
        output,
        value: new Function(NAMESPACE, ...Object.keys(args), stripTypeScriptTypes(output) + '\nreturn value;')(namespace, ...Object.values(args))
    };
}

function frame() {
    let current = callbacks;

    callbacks = [];

    for (let i = 0, n = current.length; i < n; i++) {
        current[i]();
    }
}

// Fires 'event' the way it reaches a binding on 'host': delegated ones from a descendant, bubbling
function fire(host: Host, element: Element, event: string) {
    if (host === 'element') {
        element.dispatchEvent(new Event(event));
    }
    else if (host === 'window') {
        window.dispatchEvent(new Event(event));
    }
    else {
        (element.firstChild ?? element).dispatchEvent(new Event(event, { bubbles: true }));
    }
}

// Native listener calls made while running 'fn', by host, in call order
function natives(method: 'addEventListener' | 'removeEventListener', element: () => Element | null, fn: () => void): Native[] {
    let owners = new Set<EventTarget>();

    // jsdom installs the methods on its own prototypes, not the global EventTarget's
    for (let target of [document, window] as EventTarget[]) {
        while (!Object.prototype.hasOwnProperty.call(target, method)) {
            target = Object.getPrototypeOf(target);
        }

        owners.add(target);
    }

    let calls: { native: Native; order: number }[] = [],
        spies = [...owners].map(owner => vi.spyOn(owner as EventTarget, method));

    try {
        fn();

        let node = element();

        for (let i = 0, n = spies.length; i < n; i++) {
            let mock = spies[i].mock;

            for (let j = 0, m = mock.calls.length; j < m; j++) {
                let self = mock.contexts[j];

                calls.push({
                    native: [
                        self === document ? 'document' : self === window ? 'window' : self === node ? 'element' : 'other',
                        mock.calls[j][0],
                        mock.calls[j][2]
                    ],
                    order: mock.invocationCallOrder[j]
                });
            }
        }
    }
    finally {
        for (let i = 0, n = spies.length; i < n; i++) {
            spies[i].mockRestore();
        }
    }

    return calls.sort((a, b) => a.order - b.order).map(call => call.native);
}


describe('event routing', () => {
    let disposers: VoidFunction[] = [];

    beforeEach(() => {
        callbacks = [];
    });

    afterEach(() => {
        for (let i = 0, n = disposers.length; i < n; i++) {
            disposers[i]();
        }

        // Out of the document first, so ontick's loop ends while it drains
        document.body.replaceChildren();

        for (let i = 0; i < 65; i++) {
            frame();
        }

        disposers = [];
        vi.restoreAllMocks();
    });

    function owned(fn: () => Element): { dispose: VoidFunction; element: Element } {
        let element: Element | null = null,
            dispose = root((dispose) => {
                element = fn();
                return dispose;
            });

        disposers.push(dispose);

        return { dispose, element: element! };
    }

    describe.each(PATHS)('%s', (path) => {
        it.each(KEYS)('%s registers one native listener on the %s for %s, released with its owner', (key, host, event) => {
            let bound: { dispose: VoidFunction; element: Element } | null = null,
                added = natives('addEventListener', () => bound?.element ?? null, () => {
                    bound = owned(() => bind(path, key, () => {}));
                });

            expect(added).toEqual([[host, event, { capture: false, passive: PASSIVE.has(event) }]]);

            let removed = natives('removeEventListener', () => bound!.element, () => bound!.dispose());

            expect(removed).toEqual([[host, event, false]]);
        });

        it.each(KEYS)('%s runs with its element, the event and a disposer, once for a once key', (key, host, event) => {
            let calls: unknown[][] = [],
                { element } = owned(() => bind(path, key, function (this: unknown, ...args: unknown[]) {
                    calls.push([this, ...args]);
                }));

            element.append(document.createElement('span'));
            document.body.append(element as unknown as Node);
            fire(host, element, event);
            fire(host, element, event);

            expect(calls).toHaveLength(key.toLowerCase().startsWith('once') ? 1 : 2);
            expect(calls[0][0]).toBe(element);
            expect(calls[0][1]).toBeInstanceOf(Event);
            expect((calls[0][1] as Event).type).toBe(event);
            expect(calls[0][2]).toBeTypeOf('function');
        });

        it.each(['onclick', 'onfocus', 'ondocumentkeydown', 'onwindowresize'])('%s stops for good when its handler calls the disposer', (key) => {
            let calls = 0,
                host = KEYS.find(([k]) => k === key)![1],
                event = KEYS.find(([k]) => k === key)![2],
                { element } = owned(() => bind(path, key, (_e: Event, dispose: VoidFunction) => {
                    calls++;
                    dispose();
                }));

            document.body.append(element as unknown as Node);
            fire(host, element, event);
            fire(host, element, event);

            expect(calls).toBe(1);

            // Released already, so the owner's disposal removes nothing a second time
            let removed = natives('removeEventListener', () => element, () => disposers.pop()!());

            expect(removed).toEqual([]);
        });

        it.each(['onactivewheel', 'onceActiveTouchMove'])('rejects %s', (key) => {
            expect(() => bind(path, key, () => {})).toThrow(`'${key}' is not an event attribute`);
        });

        it('rejects on', () => {
            expect(() => bind(path, 'on', () => {})).toThrow(`'on' is not an attribute`);
        });

        it.each(['onconnect', 'onConnect', 'onfirstpaint', 'ondisconnect', 'ontick'])('%s routes to its hook', (key) => {
            let calls: unknown[][] = [],
                { dispose, element } = owned(() => bind(path, key, (...args: unknown[]) => { calls.push(args); }));

            document.body.append(element as unknown as Node);
            frame();
            frame();
            dispose();

            let lower = key.toLowerCase();

            expect(calls.length).toBeGreaterThan(0);

            if (lower === 'ontick') {
                expect(calls[0][0]).toBeTypeOf('function');
                expect(calls[0][1]).toBe(element);
            }
            else {
                expect(calls[0][0]).toBe(element);
            }

            if (lower === 'onconnect') {
                expect(calls[0][1]).toBeTypeOf('function');
            }
        });
    });

    describe('every direct-attach event', () => {
        it.each([...DIRECT_ATTACH_EVENTS])('%s attaches to the element on every path', (event) => {
            for (let path of PATHS) {
                let bound: { dispose: VoidFunction; element: Element } | null = null,
                    added = natives('addEventListener', () => bound?.element ?? null, () => {
                        bound = owned(() => bind(path, 'on' + event, () => {}));
                    });

                expect(added).toEqual([['element', event, { capture: false, passive: false }]]);
                bound!.dispose();
            }
        });
    });

    describe('replacement', () => {
        it.each(['onclick', 'onfocus', 'ondocumentkeydown', 'onwindowresize'])('a later %s replaces the earlier one on its element and releases it', (key) => {
            let [, host, event] = KEYS.find(([k]) => k === key)!,
                calls: string[] = [],
                { dispose, element } = owned(() => {
                    let element = document.createElement('div') as unknown as Element;

                    runtime(element, key as `on${string}`, () => { calls.push('first'); });
                    runtime(element, key as `on${string}`, () => { calls.push('second'); });

                    return element;
                });

            element.append(document.createElement('span'));
            document.body.append(element as unknown as Node);
            fire(host, element, event);

            expect(calls).toEqual(['second']);

            // Both released, so the shared native listener goes with the last
            expect(natives('removeEventListener', () => element, dispose)).toEqual([[host, event, false]]);
        });

        it('a once key replaces the plain key, and the reverse', () => {
            let calls: string[] = [],
                { element } = owned(() => {
                    let element = document.createElement('button') as unknown as Element;

                    runtime(element, 'onclick', () => { calls.push('plain'); });
                    runtime(element, 'onceclick', () => { calls.push('once'); });

                    return element;
                });

            document.body.append(element as unknown as Node);
            element.click();
            element.click();

            expect(calls).toEqual(['once']);

            runtime(element, 'onceclick', () => { calls.push('once again'); });
            runtime(element, 'onclick', () => { calls.push('plain again'); });
            element.click();

            expect(calls).toEqual(['once', 'plain again']);
        });

        it('does not cross elements, events or hosts', () => {
            let calls: string[] = [],
                { element } = owned(() => {
                    let element = document.createElement('button') as unknown as Element,
                        other = document.createElement('button') as unknown as Element;

                    element.append(other as unknown as Node);
                    runtime(element, 'onclick', () => { calls.push('click'); });
                    runtime(element, 'onmousedown', () => { calls.push('mousedown'); });
                    runtime(element, 'ondocumentclick', () => { calls.push('document click'); });
                    runtime(element, 'onwindowclick', () => { calls.push('window click'); });
                    runtime(other, 'ondocumentclick', () => { calls.push('other document click'); });

                    return element;
                });

            document.body.append(element as unknown as Node);
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

            expect(calls).toEqual(['click', 'document click', 'other document click', 'window click', 'mousedown']);
        });

        it('leaves on() bindings beside it', () => {
            let calls: string[] = [],
                { element } = owned(() => {
                    let element = document.createElement('input') as unknown as Element;

                    disposers.push(on(element, 'focus', () => { calls.push('on'); }));
                    disposers.push(on(document, 'keydown', () => { calls.push('on document'); }));
                    runtime(element, 'onfocus', () => { calls.push('first'); });
                    runtime(element, 'onfocus', () => { calls.push('second'); });
                    runtime(element, 'ondocumentkeydown', () => { calls.push('document first'); });
                    runtime(element, 'ondocumentkeydown', () => { calls.push('document second'); });

                    return element;
                });

            document.body.append(element as unknown as Node);
            element.dispatchEvent(new Event('focus'));
            document.dispatchEvent(new Event('keydown'));

            expect(calls).toEqual(['on', 'second', 'on document', 'document second']);
        });
    });

    describe('shared native listeners', () => {
        it('one per document event across delegated and document keys, one per element for direct ones', () => {
            let elements: Element[] = [],
                added = natives('addEventListener', () => elements[0] ?? null, () => {
                    owned(() => {
                        for (let i = 0; i < 3; i++) {
                            let element = document.createElement('div') as unknown as Element;

                            runtime(element, 'onkeydown', () => {});
                            runtime(element, 'ondocumentkeydown', () => {});
                            runtime(element, 'onfocus', () => {});
                            runtime(element, 'onwindowkeydown', () => {});
                            elements.push(element);
                        }

                        return elements[0];
                    });
                });

            expect(added).toEqual([
                ['document', 'keydown', { capture: false, passive: false }],
                ['element', 'focus', { capture: false, passive: false }],
                ['window', 'keydown', { capture: false, passive: false }],
                ['other', 'focus', { capture: false, passive: false }],
                ['other', 'focus', { capture: false, passive: false }]
            ]);
        });

        it('keeps the document listener until the last delegated or document binding goes', () => {
            let a = owned(() => {
                    let element = document.createElement('div') as unknown as Element;

                    runtime(element, 'onkeydown', () => {});

                    return element;
                }),
                b = owned(() => {
                    let element = document.createElement('div') as unknown as Element;

                    runtime(element, 'ondocumentkeydown', () => {});

                    return element;
                });

            expect(natives('removeEventListener', () => null, a.dispose)).toEqual([]);
            expect(natives('removeEventListener', () => null, b.dispose)).toEqual([['document', 'keydown', false]]);
        });
    });

    describe('guarding', () => {
        it.each(['ondocumentkeydown', 'onwindowkeydown'])('%s does not run while its element is out of the document', (key) => {
            let calls = 0,
                target = key.startsWith('ondocument') ? document : window,
                { element } = owned(() => bind('runtime', key, () => { calls++; }));

            target.dispatchEvent(new Event('keydown'));

            expect(calls).toBe(0);

            document.body.append(element as unknown as Node);
            target.dispatchEvent(new Event('keydown'));

            expect(calls).toBe(1);
        });

        it.each(['ondocumentkeydown', 'onwindowkeydown'])('%s is released once foreign code removed its element past the end of the task', async (key) => {
            let calls = 0,
                target: Document | Window = key.startsWith('ondocument') ? document : window,
                { element } = owned(() => bind('attribute', key, () => { calls++; }));

            using remove = vi.spyOn(target, 'removeEventListener');

            document.body.append(element as unknown as Node);
            target.dispatchEvent(new Event('keydown'));
            element.remove();
            target.dispatchEvent(new Event('keydown'));

            expect(remove).not.toHaveBeenCalled();

            await Promise.resolve();

            expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), false);

            document.body.append(element as unknown as Node);
            target.dispatchEvent(new Event('keydown'));

            expect(calls).toBe(1);
        });
    });
});
