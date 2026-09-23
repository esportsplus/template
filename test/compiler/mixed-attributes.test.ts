import { afterEach, describe, expect, it } from 'vitest';
import { stripTypeScriptTypes } from 'node:module';
import { languageService } from '@esportsplus/typescript/compiler';
import { read, root, signal, write } from '@esportsplus/reactivity';
import * as runtime from '../../src';
import { remove as cleanupRemove } from '../../src/slot/cleanup';
import { generateCode } from '../../src/compiler/codegen';
import { findTemplateArtifacts } from '../../src/compiler/ts-parser';
import { NAMESPACE } from '../../src/compiler/constants';
import parser from '../../src/compiler/parser';


const tick = () => new Promise(resolve => requestAnimationFrame(resolve));

function compile(source: string, args: Record<string, unknown> = {}, checked = true) {
    let parsed = checked
            ? languageService.scratch(process.cwd() + '/mixed-fixture.ts', source)
            : { sourceFile: languageService.parse(process.cwd() + '/mixed-fixture.ts', source), checker: undefined },
        { sourceFile, checker } = parsed,
        result = generateCode(findTemplateArtifacts(sourceFile).templates, sourceFile, checker),
        output = source;

    for (let replacement of [...result.replacements].sort((a, b) => b.node.getStart(sourceFile) - a.node.getStart(sourceFile))) {
        output = output.slice(0, replacement.node.getStart(sourceFile)) + replacement.generate(sourceFile) + output.slice(replacement.node.end);
    }

    output = result.prepend.join('\n') + '\n' + output;
    let js = stripTypeScriptTypes(output);

    return {
        result,
        output,
        value: new Function(NAMESPACE, ...Object.keys(args), js + '\nreturn value;')(runtime, ...Object.values(args))
    };
}

afterEach(() => document.body.replaceChildren());

describe('compiled mixed attribute values', () => {
    it('keeps neighboring class effects separate from a runtime base', async () => {
        let active = signal(false),
            { value: node } = compile('let value = html`<div class="${base} ${() => active() && "--active"}"></div>`;', {
                base: 'checkbox checkbox--radio', active: () => read(active)
            });
        let element = node.firstChild as HTMLElement;
        document.body.append(node);
        expect(element.className.trim()).toBe('checkbox checkbox--radio');
        write(active, true); await tick();
        expect(element.classList.contains('--active')).toBe(true);
        write(active, false); await tick();
        expect(element.className.trim()).toBe('checkbox checkbox--radio');
        expect(document.body.firstChild).toBe(element);
    });

    it('preserves quoted spaces and concatenates numeric values as text', () => {
        let { value } = compile('let value = html`<div title="${first}  ${last}" data-pair="${first}${last}"></div>`;', { first: 1, last: 2 });
        expect(value.firstChild.title).toBe('1  2');
        expect(value.firstChild.getAttribute('data-pair')).toBe('12');
    });

    it('resolves callback identifiers in prefixed classes and styles reactively', async () => {
        let size = signal(12),
            { value } = compile('let value = html`<div class="item-${getter}" style="width: ${getter}px" title="size ${getter}"></div>`;', { getter: () => read(size) });
        let element = value.firstChild as HTMLElement;
        expect(element.className).toBe('item-12');
        expect(element.style.width).toBe('12px');
        write(size, 24); await tick();
        expect(element.className).toBe('item-24');
        expect(element.style.width).toBe('24px');
        expect(element.title).toBe('size 24');
    });

    it('preserves whitespace in static quoted attributes', () => {
        let { value } = compile('let value = html`<div title="first  last" data-value="a\tb"></div>`;');
        expect(value.firstChild.title).toBe('first  last');
        expect(value.firstChild.getAttribute('data-value')).toBe('a\tb');
    });

    it.each([' ', '\t', '\n'])('separates class marker groups on %j', whitespace => {
        let parsed = parser.parse(['<div class="', whitespace, '"></div>']);
        let slot = parsed.slots![0];
        if (slot.type !== 'attribute') throw new Error('Expected attribute');
        expect(slot.attributes.parts[0].group).not.toBe(slot.attributes.parts[1].group);
    });

    it('precompiles all factory class variants and keeps their effects live', async () => {
        let active = signal(false),
            source = [
                "const factory = (type: 'checkbox' | 'radio' | 'switch') => {",
                ' return function template() {',
                '  return html`<div class="${type === "radio" ? "checkbox checkbox--radio" : type} ${() => active() && "--active"}"></div>`;',
                ' };',
                '};',
                "let value = ['checkbox', 'radio', 'switch'].map(type => factory(type)());"
            ].join('\n'),
            { value, result } = compile(source, { active: () => read(active) });
        let html = [...result.templates.keys()].join('\n');
        for (let name of ['checkbox', 'checkbox checkbox--radio', 'switch']) {
            expect(html).toContain(`class="${name} `);
        }
        let elements = value.map((fragment: DocumentFragment) => fragment.firstChild as HTMLElement);
        expect(elements.map((el: HTMLElement) => el.className.trim())).toEqual(['checkbox', 'checkbox checkbox--radio', 'switch']);
        write(active, true); await tick();
        for (let element of elements) expect(element.classList.contains('--active')).toBe(true);
        write(active, false); await tick();
        expect(elements.map((el: HTMLElement) => el.className.trim())).toEqual(['checkbox', 'checkbox checkbox--radio', 'switch']);
    });

    it.each([true, false])('supports two independent class callbacks (checker: %s)', async checked => {
        let first = signal(false), second = signal(false), firstRuns = 0, secondRuns = 0;
        let { value } = compile('let value = html`<div class="fixed ${one} ${two}"></div>`;', {
            one: () => { firstRuns++; return read(first) && 'one'; },
            two: () => { secondRuns++; return read(second) && 'two'; }
        }, checked);
        write(first, true); await tick();
        expect(value.firstChild.className).toBe('fixed one');
        expect(firstRuns).toBe(2); expect(secondRuns).toBe(1);
        write(second, true); await tick();
        expect(value.firstChild.classList.contains('two')).toBe(true);
        write(first, false); await tick();
        expect(value.firstChild.className).toBe('fixed two');
    });

    it('captures factories once, passes the element, and disposes composed effects', async () => {
        let state = signal('a'), calls: string[] = [], element: HTMLElement | undefined, dispose = () => {};
        let { value } = root(stop => {
            dispose = stop;
            return compile('let value = html`<div title="before ${make()} after ${suffix()}"></div>`;', {
                make: () => { calls.push('make'); return (el: HTMLElement) => { element = el; calls.push('read'); return read(state); }; },
                suffix: () => { calls.push('suffix'); return '!'; }
            });
        });
        expect(calls).toEqual(['make', 'suffix', 'read']);
        expect(element).toBe(value.firstChild);
        write(state, 'b'); await tick();
        expect(element!.title).toBe('before b after !');
        expect(calls).toEqual(['make', 'suffix', 'read', 'read']);
        dispose(); write(state, 'c'); await tick();
        expect(calls).toHaveLength(4);
    });

    it('normalizes absent callback fragments without losing zero or standalone arrays', async () => {
        let state = signal<unknown>(false),
            { value } = compile('let value = html`<div title="[${getter}]" class="base ${classes}"></div>`;', {
                getter: () => read(state), classes: ['one', () => 'two']
            });
        expect(value.firstChild.title).toBe('[]');
        expect(value.firstChild.className).toBe('base one two');
        for (let next of [null, undefined, 0]) {
            write(state, next); await tick();
            expect(value.firstChild.title).toBe(next === 0 ? '[0]' : '[]');
        }
    });

    it('does not invoke event callbacks as interpolation getters', () => {
        let calls = 0;
        let { value } = compile('let value = html`<button class="${base} ${() => "ready"}" onclick=${handler}></button>`;', {
            base: 'button', handler: () => calls++
        });
        document.body.append(value);
        expect(calls).toBe(0);
        (document.body.firstChild as HTMLButtonElement).click();
        expect(calls).toBe(1);
    });

    it('keeps literal-returning effects as runtime callbacks while folding constants', () => {
        let { value, result, output } = compile('const base = "static"; let value = html`<div class="${base} ${() => "dynamic"}"></div>`;');
        expect([...result.templates.keys()].join('')).toContain('static');
        expect([...result.templates.keys()].join('')).not.toContain('dynamic');
        expect(output).toContain('() => "dynamic"');
        expect(value.firstChild.className).toBe('static dynamic');
    });

    it('retains generic behavior for unexpected runtime factory values', () => {
        let { value } = compile('const factory = (type: "checkbox" | "radio") => () => html`<div class="${type} ${() => "ready"}"></div>`; let value = factory(actual)();', { actual: 'other' });
        expect(value.firstChild.className).toBe('other ready');
    });

    it.each([
        'type = "radio";',
        'const mutate = () => { type = "radio"; }; mutate();',
        '({ type } = { type: "radio" });',
        'for (type of ["radio"] as const) {}'
    ])('does not specialize a mutated parameter: %s', mutation => {
        let { value, result } = compile('const factory = (type: "checkbox" | "radio") => { ' + mutation + ' return () => html`<div class="${type} ${() => "ready"}"></div>`; }; let value = factory("checkbox")();');
        expect(result.templates.size).toBe(1);
        expect(value.firstChild.className).toBe('radio ready');
    });

    it('caps finite variant expansion', () => {
        let types = Array.from({ length: 17 }, (_, index) => JSON.stringify('t' + index)).join(' | ');
        let { value, result } = compile('const factory = (type: ' + types + ') => () => html`<div class="${type} ${() => "ready"}"></div>`; let value = factory("t0")();');
        expect(result.templates.size).toBe(1);
        expect(value.firstChild.className).toBe('t0 ready');
    });

    it('does not eliminate getter reads because their return type is a literal', () => {
        let { value } = compile('let calls = 0; const data = { get value(): "a" { calls++; return "a"; } }; let node = html`<div title="${data.value}"></div>`; let value = { node, calls };');
        expect(value.calls).toBe(1);
        expect(value.node.firstChild.title).toBe('a');
    });

    it('does not freeze mutable literal-typed values', () => {
        let { value } = compile('let type = "a" as "a" | "b"; const render = () => html`<div class="${type} ${() => "ready"}"></div>`; type = "b"; let value = render();');
        expect(value.firstChild.className).toBe('b ready');
    });

    it('keeps specialization caches isolated across nested factory templates', () => {
        let { value, result } = compile('const factory = (type: "checkbox" | "radio") => () => html`<section>${html`<div class="${type} ${() => "ready"}"></div>`}</section>`; let value = [factory("checkbox")(), factory("radio")()];');
        expect(value.map((fragment: DocumentFragment) => fragment.querySelector('div')!.className)).toEqual(['checkbox ready', 'radio ready']);
        expect([...result.templates.keys()].join('')).toContain('checkbox');
        expect([...result.templates.keys()].join('')).toContain('radio');
    });

    it('specializes multiple immutable parameters without sharing the wrong clone', () => {
        let { value, result } = compile('const factory = (type: "a" | "b", size: 1 | 2) => () => html`<div class="${type + size} ${() => "ready"}"></div>`; let value = [factory("a", 1)(), factory("b", 2)()];');
        expect(value.map((fragment: DocumentFragment) => fragment.firstElementChild!.className)).toEqual(['a1 ready', 'b2 ready']);
        let html = [...result.templates.keys()].join('');
        for (let name of ['a1', 'a2', 'b1', 'b2']) expect(html).toContain(name);
    });

    it('retains runtime calls even when their declared result is a literal', () => {
        let { value } = compile('let calls = 0; const get = (): "a" => { calls++; return actual; }; const type = get(); let node = html`<div class="${type} ${() => "ready"}"></div>`; let value = { node, calls };', { actual: 'runtime' });
        expect(value.calls).toBe(1);
        expect(value.node.firstChild.className).toBe('runtime ready');
    });

    it('does not eliminate object-producing calls when reading literal-typed properties', () => {
        let { value } = compile('let calls = 0; const get = () => { calls++; return { type: "a" as const }; }; let node = html`<div title="${get().type}"></div>`; let value = { node, calls };');
        expect(value.calls).toBe(1);
        expect(value.node.firstChild.title).toBe('a');
    });

    it('folds pure constant conditionals without folding the following callback', () => {
        let { result, value } = compile('const type = "radio"; let value = html`<div class="${type === "radio" ? "checkbox checkbox--radio" : type} ${() => "ready"}"></div>`;');
        expect([...result.templates.keys()].join('')).toContain('checkbox checkbox--radio');
        expect([...result.templates.keys()].join('')).not.toContain('ready');
        expect(value.firstChild.className).toBe('checkbox checkbox--radio ready');
    });
});

describe('compiled host bindings and unquoted attributes', () => {
    it.each([
        '<button ondocumentkeydown=${handler} aria-label=${label} data-state=${() => "ready"}></button>',
        '<button ondocumentkeydown="${handler}" aria-label=${label} data-state=${() => "ready"}></button>',
        '<button ${{ ondocumentkeydown: handler }} aria-label=${label} data-state=${() => "ready"}></button>',
        '<button ${properties} aria-label=${label} data-state=${() => "ready"}></button>'
    ])('registers and cleans up %s', markup => {
        let calls = 0,
            handler = () => { calls++; },
            { value, result } = compile(
                'let value = html`' + markup + '`;',
                { handler, label: 'Search', properties: { ondocumentkeydown: handler } }
            ),
            element = value.firstChild as runtime.Element;

        document.body.append(value);

        expect(calls).toBe(0);

        for (let html of result.templates.keys()) {
            expect(html).not.toContain('ondocumentkeydown');
            expect(html).not.toContain('aria-label=');
            expect(html).not.toContain('data-state=');
        }

        expect(element.getAttribute('aria-label')).toBe('Search');
        expect(element.getAttribute('data-state')).toBe('ready');

        document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));

        expect(calls).toBe(1);

        cleanupRemove([{ head: element }]);
        document.dispatchEvent(new KeyboardEvent('keydown'));

        expect(calls).toBe(1);
    });

    it.each([
        ['onceclick', "${NAMESPACE}.delegate(", ', true);'],
        ['oncefocus', "${NAMESPACE}.on(", ', true);'],
        ['oncedocumentkeydown', "${NAMESPACE}.ondocument(", ', true);'],
        ['oncewindowresize', "${NAMESPACE}.onwindow(", ', true);'],
        ['onwindowresize', "${NAMESPACE}.onwindow(", ');'],
        ['onDocumentKeyDown', "${NAMESPACE}.ondocument(", ');'],
        ['onDOMContentLoaded', "${NAMESPACE}.delegate(", ');']
    ])('compiles %s through the matching helper', (name, call, tail) => {
        let { output } = compile('let value = html`<button ' + name + '=${handler}></button>`;', { handler: () => {} });

        expect(output).toContain(call.replace('${NAMESPACE}', NAMESPACE));
        expect(output).toContain(tail);
        expect(output).toContain("'" + name.toLowerCase().replace(/^once|^on|document|window/g, '') + "'");
    });

    it('once bindings fire a single time and window bindings receive the owner', () => {
        let clicks = 0,
            self: unknown = null,
            { value } = compile(
                'let value = html`<button onceclick=${click} onwindowresize=${resize}></button>`;',
                { click: () => { clicks++; }, resize: function (this: unknown) { self = this; } }
            ),
            element = value.firstChild as HTMLElement;

        document.body.append(value);
        element.click();
        element.click();
        window.dispatchEvent(new Event('resize'));

        expect(clicks).toBe(1);
        expect(self).toBe(element);

        cleanupRemove([{ head: element as unknown as runtime.Element }]);
    });

    it('unquoted aria effects update without swallowing the next attribute', async () => {
        let dispose = () => {},
            state = signal('first'),
            { value } = root(stop => {
                dispose = stop;

                return compile(
                    'let value = html`<button aria-label=${() => state()} type="button" data-static="kept"></button>`;',
                    { state: () => read(state) }
                );
            }),
            element = value.firstChild as HTMLElement;

        expect(element.getAttribute('aria-label')).toBe('first');
        expect(element.getAttribute('type')).toBe('button');

        write(state, 'second');
        await tick();

        expect(element.getAttribute('aria-label')).toBe('second');
        expect(element.getAttribute('data-static')).toBe('kept');

        dispose();
    });
});
