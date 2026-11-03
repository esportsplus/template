import { effect, flush, read, signal, write } from '@esportsplus/reactivity';
import type { Case } from './harness';


const ROW = '<tr><td class="col-md-1"></td><td class="col-md-4"><a></a></td><td class="col-md-1"><a><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td><td class="col-md-6"></td></tr>';

const STATIC_CLASSES = 'table table-hover table-striped test-data';

const STORE = Symbol();

const STYLE = ['width: 10px', 'height: 20px', 'color: red', 'opacity: 1', 'margin: 0'];


// The string a composed value's part contributes, as interpolate() does it
function s(value: unknown): string {
    return value == null || value === false ? '' : String(value);
}

function element(html: string): Element {
    let tmpl = document.createElement('template');

    tmpl.innerHTML = html;

    return tmpl.content.firstChild as Element;
}

// The runtime join composed values used before the compiler emitted concatenation (0.57.0's interpolate)
function interpolate(parts: unknown[]): string | ((element?: unknown) => string) {
    let callbacks = parts.map(part => typeof part === 'function');

    const join = (element?: unknown) => {
        let result = '';

        for (let i = 0; i < parts.length; i++) {
            let value = callbacks[i] ? (parts[i] as Function)(element) : parts[i];

            if (value != null && value !== false) {
                result += String(value);
            }
        }

        return result;
    };

    return callbacks.some(Boolean) ? join : join();
}

function fragment(html: string): DocumentFragment {
    let tmpl = document.createElement('template');

    tmpl.innerHTML = html;

    return tmpl.content;
}

function mounted(html: string): Element {
    let el = element(html);

    document.body.appendChild(el);

    return el;
}

// Today's collect(): split on the delimiter, trim, drop empties
function tokens(value: string, into: string[]): void {
    let parts = value.split(' ');

    for (let i = 0, n = parts.length; i < n; i++) {
        let part = parts[i].trim();

        if (part !== '') {
            into.push(part);
        }
    }
}


const cases: Case[] = [
    {
        item: 'A.1',
        iterations: 20000,
        name: 'row instance: clone the template fragment vs clone its single root element',
        setup: () => ({ element: element(ROW), fragment: fragment(ROW), i: 0, sink: document.createElement('tbody') }),
        variants: [
            {
                fn: (ctx) => {
                    let f = ctx.fragment.cloneNode(true) as DocumentFragment,
                        tr = f.firstChild as Element;

                    void tr.firstChild;
                    ctx.sink.appendChild(f);

                    if (++ctx.i === 1000) {
                        ctx.i = 0;
                        ctx.sink.textContent = '';
                    }
                },
                name: 'fragment.cloneNode(true), read firstChild, append fragment'
            },
            {
                fn: (ctx) => {
                    let tr = ctx.element.cloneNode(true) as Element;

                    void tr.firstChild;
                    ctx.sink.appendChild(tr);

                    if (++ctx.i === 1000) {
                        ctx.i = 0;
                        ctx.sink.textContent = '';
                    }
                },
                name: 'element.cloneNode(true), append element'
            }
        ]
    },
    {
        item: 'A.2',
        iterations: 200000,
        name: 'text node: clone an empty text node then set nodeValue vs createTextNode(value)',
        setup: () => ({ i: 0, txt: document.createTextNode('') }),
        variants: [
            {
                fn: (ctx) => {
                    let node = ctx.txt.cloneNode() as Text;

                    node.nodeValue = 'row ' + ctx.i++;
                },
                name: 'txt.cloneNode() + nodeValue'
            },
            {
                fn: (ctx) => {
                    void document.createTextNode('row ' + ctx.i++);
                },
                name: 'document.createTextNode(value)'
            }
        ]
    },
    {
        item: 'A.3',
        iterations: 500000,
        name: 'reach the 5th child: nextSibling chain vs childNodes[4]',
        setup: () => ({ tr: element('<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>') }),
        variants: [
            {
                fn: (ctx) => {
                    void ctx.tr.firstChild.nextSibling.nextSibling.nextSibling.nextSibling;
                },
                name: 'firstChild.nextSibling x4'
            },
            {
                fn: (ctx) => {
                    void ctx.tr.childNodes[4];
                },
                name: 'childNodes[4]'
            },
            {
                fn: (ctx) => {
                    void ctx.tr.firstChild.nextSibling;
                },
                name: 'firstChild.nextSibling (index 1, for scale)'
            },
            {
                fn: (ctx) => {
                    void ctx.tr.childNodes[1];
                },
                name: 'childNodes[1] (index 1, for scale)'
            }
        ]
    },
    {
        item: 'A.4',
        iterations: 500000,
        name: 'reach the 3rd child element: element-only walk vs node walk (no text nodes present)',
        setup: () => ({ div: element('<div><p></p><p></p><p></p></div>') }),
        variants: [
            {
                fn: (ctx) => {
                    void ctx.div.firstElementChild.nextElementSibling.nextElementSibling;
                },
                name: 'firstElementChild.nextElementSibling x2'
            },
            {
                fn: (ctx) => {
                    void ctx.div.firstChild.nextSibling.nextSibling;
                },
                name: 'firstChild.nextSibling x2'
            }
        ]
    },
    {
        item: 'B.1',
        iterations: 200000,
        name: 'composed value, per instance: interpolate([...]) then one call vs a compiled concatenation',
        setup: () => ({ el: element('<div></div>'), fn: (() => { let n = 0; return () => n++; })() }),
        variants: [
            {
                fn: (ctx) => {
                    let join = interpolate(['width: ', ctx.fn, 'px']) as (element: any) => string;

                    void join(ctx.el);
                },
                name: 'interpolate() build + call'
            },
            {
                fn: (ctx) => {
                    let fn = ctx.fn,
                        join = (el: unknown) => 'width: ' + s(fn(el)) + 'px';

                    void join(ctx.el);
                },
                name: 'closure "width: " + s(fn(el)) + "px" build + call'
            }
        ]
    },
    {
        item: 'B.1',
        iterations: 500000,
        name: 'composed value, per update: one call of the prebuilt join',
        setup: () => {
            let fn = (() => { let n = 0; return () => n++; })();

            return {
                compiled: (el: unknown) => 'width: ' + s(fn(el)) + 'px',
                el: element('<div></div>'),
                interpolated: interpolate(['width: ', fn, 'px']) as (element: any) => string
            };
        },
        variants: [
            {
                fn: (ctx) => {
                    void ctx.interpolated(ctx.el);
                },
                name: 'interpolate() join'
            },
            {
                fn: (ctx) => {
                    void ctx.compiled(ctx.el);
                },
                name: 'compiled concatenation'
            }
        ]
    },
    {
        item: 'B.2',
        iterations: 100000,
        name: 'toggle one class on a mounted element with 3 static classes',
        setup: () => ({ dynamic: new Set<string>(), el: mounted('<div class="a b c"></div>'), on: false }),
        variants: [
            {
                fn: (ctx) => {
                    let on = ctx.on = !ctx.on;

                    if (on) {
                        ctx.dynamic.add('danger');
                    }
                    else {
                        ctx.dynamic.delete('danger');
                    }

                    let joined = 'a b c';

                    for (let key of ctx.dynamic) {
                        joined += ' ' + key;
                    }

                    ctx.el.className = joined;
                },
                name: 'rebuild static + dynamic set, write className (today)'
            },
            {
                fn: (ctx) => {
                    ctx.el.classList.toggle('danger', ctx.on = !ctx.on);
                },
                name: 'classList.toggle(token, on)'
            },
            {
                fn: (ctx) => {
                    ctx.el.className = (ctx.on = !ctx.on) ? 'a b c danger' : 'a b c';
                },
                name: 'write a precomputed className (lower bound)'
            }
        ]
    },
    {
        item: 'B.3',
        iterations: 100000,
        name: 'change one of 5 style declarations on a mounted element',
        setup: () => ({ el: mounted(`<div style="${STYLE.join('; ')}"></div>`), i: 0, parts: STYLE.slice() }),
        variants: [
            {
                fn: (ctx) => {
                    ctx.parts[0] = 'width: ' + (ctx.i++ & 1023) + 'px';

                    let joined = ctx.parts[0];

                    for (let i = 1, n = ctx.parts.length; i < n; i++) {
                        joined += ';' + ctx.parts[i];
                    }

                    ctx.el.style.cssText = joined;
                },
                name: 'rebuild and write cssText (today)'
            },
            {
                fn: (ctx) => {
                    ctx.el.style.setProperty('width', (ctx.i++ & 1023) + 'px');
                },
                name: 'style.setProperty(name, value)'
            },
            {
                fn: (ctx) => {
                    ctx.el.style.width = (ctx.i++ & 1023) + 'px';
                },
                name: 'style.width = value'
            }
        ]
    },
    {
        item: '0.4',
        iterations: 200000,
        name: 'seed a list store from 4 static class tokens: read attribute and split vs assign a precomputed string',
        setup: () => ({ el: element(`<table class="${STATIC_CLASSES}"></table>`) }),
        variants: [
            {
                fn: (ctx) => {
                    let parts: string[] = [],
                        state = { dynamic: new Set<string>(), static: '' };

                    tokens((ctx.el.getAttribute('class') || '').trim(), parts);

                    for (let i = 0, n = parts.length; i < n; i++) {
                        state.static += (state.static ? ' ' : '') + parts[i];
                    }

                    void state;
                },
                name: 'getAttribute + split + trim + join (collect)'
            },
            {
                fn: () => {
                    let state = { dynamic: new Set<string>(), static: STATIC_CLASSES };

                    void state;
                },
                name: 'assign the compile-time string'
            }
        ]
    },
    {
        item: '0.2',
        iterations: 200000,
        name: 'per-part bookkeeping on a fresh element: expando raw/cold records vs one closure-local state',
        setup: () => ({ i: 0 }),
        variants: [
            {
                fn: (ctx) => {
                    let el = document.createElement('div') as any,
                        c = el[STORE] ??= { element: el };

                    c.effect ??= 0;

                    let id = c.effect++;

                    (c.raw ??= [])[id] = ctx.i;
                    (c.cold ??= {})[id] = { danger: true };
                    ctx.i++;
                },
                name: 'ctx.effect / ctx.raw[id] / ctx.cold[id] on the element (today)'
            },
            {
                fn: (ctx) => {
                    let el = document.createElement('div') as any,
                        c = el[STORE] ??= { element: el },
                        state = { cold: { danger: true }, raw: ctx.i };

                    void c;
                    void state;
                    ctx.i++;
                },
                name: 'store on the element, raw/cold in the closure'
            }
        ]
    },
    {
        item: 'H.1',
        iterations: 20000,
        name: 'attribute effect creation: manual prev compare in the closure vs effect(fn, apply)',
        setup: () => ({ el: element('<div></div>'), sig: signal(0), stops: [] as VoidFunction[] }),
        variants: [
            {
                fn: (ctx) => {
                    let el = ctx.el,
                        prev: unknown,
                        sig = ctx.sig;

                    ctx.stops.push(effect(() => {
                        let v = read(sig);

                        if (v !== prev) {
                            prev = v;
                            el.title = String(v);
                        }
                    }));

                    if (ctx.stops.length === 1000) {
                        for (let i = 0; i < 1000; i++) {
                            ctx.stops[i]();
                        }

                        ctx.stops.length = 0;
                    }
                },
                name: 'effect(fn) with prev in the closure'
            },
            {
                fn: (ctx) => {
                    let el = ctx.el,
                        sig = ctx.sig;

                    ctx.stops.push(effect(() => read(sig), (v, prev) => {
                        if (v !== prev) {
                            el.title = String(v);
                        }
                    }));

                    if (ctx.stops.length === 1000) {
                        for (let i = 0; i < 1000; i++) {
                            ctx.stops[i]();
                        }

                        ctx.stops.length = 0;
                    }
                },
                name: 'effect(fn, apply)'
            }
        ]
    },
    {
        item: 'H.1',
        iterations: 2000,
        name: 'attribute effect update: 1000 effects on one signal, write + flush',
        setup: () => {
            let el = element('<div></div>'),
                sig = signal(0);

            return {
                build: (variant: number) => {
                    let stops: VoidFunction[] = [];

                    for (let i = 0; i < 1000; i++) {
                        if (variant === 0) {
                            let prev: unknown;

                            stops.push(effect(() => {
                                let v = read(sig);

                                if (v !== prev) {
                                    prev = v;
                                    el.title = String(v);
                                }
                            }));
                        }
                        else {
                            stops.push(effect(() => read(sig), (v, prev) => {
                                if (v !== prev) {
                                    el.title = String(v);
                                }
                            }));
                        }
                    }

                    return stops;
                },
                built: -1,
                i: 0,
                sig,
                stops: [] as VoidFunction[]
            };
        },
        variants: [
            {
                fn: (ctx) => {
                    if (ctx.built !== 0) {
                        for (let i = 0, n = ctx.stops.length; i < n; i++) {
                            ctx.stops[i]();
                        }

                        ctx.stops = ctx.build(ctx.built = 0);
                    }

                    write(ctx.sig, ++ctx.i);
                    flush();
                },
                name: 'effect(fn) with prev in the closure'
            },
            {
                fn: (ctx) => {
                    if (ctx.built !== 1) {
                        for (let i = 0, n = ctx.stops.length; i < n; i++) {
                            ctx.stops[i]();
                        }

                        ctx.stops = ctx.build(ctx.built = 1);
                    }

                    write(ctx.sig, ++ctx.i);
                    flush();
                },
                name: 'effect(fn, apply)'
            }
        ]
    }
];


export default cases;
