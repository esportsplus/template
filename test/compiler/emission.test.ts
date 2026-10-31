import { afterEach, describe, expect, it } from 'vitest';
import { stripTypeScriptTypes } from 'node:module';
import { languageService } from '@esportsplus/typescript/compiler';
import { read, signal, write } from '@esportsplus/reactivity';
import * as runtime from '../../src';
import { generateCode } from '../../src/compiler/codegen';
import { NAMESPACE } from '../../src/compiler/constants';
import { findTemplateArtifacts } from '../../src/compiler/ts-parser';


// Lowers 'source' with a checker for folding and specialization, then runs it; 'value' is what it returns
function compile(source: string, args: Record<string, unknown> = {}) {
    let { checker, sourceFile } = languageService.scratch(process.cwd() + '/emission-fixture.ts', source),
        result = generateCode(findTemplateArtifacts(sourceFile), sourceFile, checker),
        output = source;

    for (let replacement of [...result.replacements].sort((a, b) => b.node.getStart(sourceFile) - a.node.getStart(sourceFile))) {
        output = output.slice(0, replacement.node.getStart(sourceFile)) + replacement.generate(sourceFile) + output.slice(replacement.node.end);
    }

    output = result.prepend.join('\n') + '\n' + output;

    return {
        output,
        result,
        value: new Function(NAMESPACE, ...Object.keys(args), stripTypeScriptTypes(output) + '\nreturn value;')(runtime, ...Object.values(args))
    };
}

function mount(node: Node) {
    let host = document.createElement('div');

    host.append(node);
    document.body.append(host);

    return host;
}


afterEach(() => document.body.replaceChildren());


describe('compiler emission', () => {
    describe('template text', () => {
        it('keeps a backslash in text', () => {
            let { value } = compile(String.raw`let value = html` + '`<code>C:\\\\temp</code>`;');

            expect(mount(value).textContent).toBe('C:\\temp');
        });

        it('keeps an escaped backtick', () => {
            let { value } = compile('let value = html`<code>\\`tick\\`</code>`;');

            expect(mount(value).textContent).toBe('`tick`');
        });

        it('keeps an escaped interpolation as text beside a real slot', () => {
            let { value } = compile('let value = html`<p>${label}</p><code>\\${not}</code>`;', { label: 'yes' });

            expect(mount(value).textContent).toBe('yes${not}');
        });

        it('keeps a backslash before a real slot', () => {
            let { value } = compile('let value = html`<p>\\\\${label}</p>`;', { label: 'x' });

            expect(mount(value).textContent).toBe('\\x');
        });

        it.each([
            ['a backslash', '`<p>C:\\\\temp</p>`', '<p>C:\\temp'],
            ['a backtick', '`<p>\\`x\\`</p>`', '<p>`x`'],
            ['an escaped interpolation', '`<p>\\${a}</p>`', '<p>${a}'],
            ['a carriage return', '`<p title="a\\rb">x</p>`', '<p title="a\rb">x'],
            ['a line break', '`<p title="a\nb">x</p>`', '<p title="a\nb">x']
        ])('emits template text holding %s as a literal that reads back unchanged', (_label, template, html) => {
            let { result } = compile('let value = html' + template + ';'),
                literal = /\.template\((.*)\);$/s.exec(result.prepend[0])![1];

            expect(new Function('return ' + literal)()).toBe(html);
        });

        it('keeps unicode escapes and quotes', () => {
            let { value } = compile('let value = html`<p title="a\'b">\\u00e9 "q" ${label}</p>`;', { label: 'x' });

            let host = mount(value);

            expect(host.textContent).toBe('é "q" x');
            expect(host.querySelector('p')!.title).toBe("a'b");
        });
    });

    describe('element paths', () => {
        it('binds three or more slots under a deep shared ancestor', () => {
            let { value } = compile(
                'let value = html`<div><section><ul><li><a>${a}</a><b>${b}</b><i class=${c}></i><em title=${d}></em></li></ul></section></div>`;',
                { a: 'A', b: 'B', c: 'C', d: 'D' }
            );

            let host = mount(value);

            expect(host.querySelector('a')!.textContent).toBe('A');
            expect(host.querySelector('b')!.textContent).toBe('B');
            expect(host.querySelector('i')!.className).toBe('C');
            expect(host.querySelector('em')!.title).toBe('D');
        });

        it('binds slots in sibling subtrees and at different depths', () => {
            let { value } = compile(
                'let value = html`<div><p><span>${a}</span><span>${b}</span></p><p><span>${c}</span></p>${d}<p title=${e}><b><i>${f}</i></b></p></div>`;',
                { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }
            );

            let host = mount(value);

            expect(host.textContent).toBe('12346');
            expect(host.querySelectorAll('p')[2].title).toBe('5');
        });

        it('binds an element slot and a node slot sharing a parent', () => {
            let { value } = compile('let value = html`<ul><li class=${a}>${b}</li><li>${c}</li></ul>`;', { a: 'x', b: 'y', c: 'z' });

            let host = mount(value);

            expect(host.querySelector('li')!.className).toBe('x');
            expect(host.textContent).toBe('yz');
        });
    });

    describe('templates in return position', () => {
        it('inside try/finally', () => {
            let { value } = compile([
                'let log: string[] = [];',
                'function view(label: string) {',
                '    try {',
                '        return html`<b>${label}</b>`;',
                '    }',
                '    finally {',
                "        log.push('finally');",
                '    }',
                '}',
                "let value = [view('a'), log];"
            ].join('\n'));

            expect(mount(value[0]).textContent).toBe('a');
            expect(value[1]).toEqual(['finally']);
        });

        it('inside a switch', () => {
            let { value } = compile([
                'function view(kind: string, label: string) {',
                '    switch (kind) {',
                "        case 'a':",
                '            return html`<i>${label}</i>`;',
                "        case 'b': {",
                '            return html`<u>${label}</u>`;',
                '        }',
                '        default:',
                '            return html`<s>${label}</s>`;',
                '    }',
                '}',
                "let value = [view('a', '1'), view('b', '2'), view('c', '3')];"
            ].join('\n'));

            expect(value.map((node: Node) => mount(node).innerHTML)).toEqual(['<i>1</i>', '<u>2</u>', '<s>3</s>']);
        });

        it('inside labelled loops', () => {
            let { value } = compile([
                'function view(rows: string[][]) {',
                '    outer: for (let row of rows) {',
                '        inner: for (let cell of row) {',
                "            if (cell === 'skip') {",
                '                continue outer;',
                '            }',
                "            if (cell === 'next') {",
                '                continue inner;',
                '            }',
                '            return html`<td>${cell}</td>`;',
                '        }',
                '    }',
                '    return html`<td>${"none"}</td>`;',
                '}',
                "let value = [view([['skip', 'x'], ['next', 'y']]), view([])];"
            ].join('\n'));

            expect(value.map((node: Node) => mount(node).textContent)).toEqual(['y', 'none']);
        });

        it('lowers a returned template to statements, braced where the return stood alone', () => {
            let { output, value } = compile([
                'function view(flag: boolean, label: string) {',
                '    if (flag) return html`<b>${label}</b>`;',
                '    else return html`<i>${label}</i>`;',
                '}',
                "let value = [view(true, 'a'), view(false, 'b')];"
            ].join('\n'));

            expect(output).not.toContain('(() => {');
            expect(value.map((node: Node) => mount(node).innerHTML)).toEqual(['<b>a</b>', '<i>b</i>']);
        });

        it('inside a callback nested in a template', () => {
            let { output, value } = compile([
                'function view(items: string[]) {',
                '    return html`<ul>${items.map((item) => { if (!item) { return html`<li>-</li>`; } return html`<li>${item}</li>`; })}</ul>`;',
                '}',
                "let value = view(['a', '', 'b']);"
            ].join('\n'));

            expect(output).not.toContain('(() => {');
            expect(mount(value).innerHTML).toBe('<ul><li>a</li><li>-</li><li>b</li></ul>');
        });

        it('awaiting inside the template of an async function', async () => {
            let { value } = compile([
                'async function view(label: Promise<string>) {',
                '    return html`<b>${await label}</b>`;',
                '}',
                "let value = view(Promise.resolve('a'));"
            ].join('\n'));

            expect(mount(await value).innerHTML).toBe('<b>a</b>');
        });

        it('keeps a specialized return an expression', () => {
            let { output, value } = compile([
                "function view(type: 'a' | 'b', label: string) {",
                '    return html`<p class="${type}">${label}</p>`;',
                '}',
                "let value = view('b', 'x');"
            ].join('\n'));

            expect(output).toMatch(/return \(\(type as unknown\) === "a"/);
            expect(mount(value).innerHTML).toBe('<p class="b">x</p>');
        });

        it('as an arrow body and as an arrow block return', () => {
            let { value } = compile([
                'let a = (label: string) => html`<p>${label}</p>`,',
                '    b = (label: string) => { return html`<p>${label}</p>`; };',
                "let value = [a('x'), b('y')];"
            ].join('\n'));

            expect(value.map((node: Node) => mount(node).textContent)).toEqual(['x', 'y']);
        });
    });

    describe('interpolated attributes', () => {
        it('drops null and false parts and keeps 0', () => {
            let { value } = compile(
                'let value = html`<p title="a${n}b${f}c${z}d" data-x="${z}${n}${f}">x</p>`;',
                { f: false, n: null, z: 0 }
            );

            let p = mount(value).querySelector('p')!;

            expect(p.title).toBe('abc0d');
            expect(p.getAttribute('data-x')).toBe('0');
        });

        it('joins two numbers as text, never adding them', () => {
            let { value } = compile([
                'let a: number = 1, b: number = 2;',
                'let value = html`<p data-x="${a}${b}" title="${a} ${b}">x</p>`;'
            ].join('\n'));

            let p = mount(value).querySelector('p')!;

            expect(p.getAttribute('data-x')).toBe('12');
            expect(p.title).toBe('1 2');
        });

        it('joins strings and numbers with their literal text', () => {
            let { value } = compile([
                'function view(label: string, count: number) {',
                '    return html`<p title="${label}: ${count}" class="a ${label}-${count}">x</p>`;',
                '}',
                "let value = view('n', 0);"
            ].join('\n'));

            let p = mount(value).querySelector('p')!;

            expect(p.title).toBe('n: 0');
            expect(p.className).toBe('a n-0');
        });

        it.each([
            ['strings and numbers', 'label: string, count: number', true],
            ['literal and template literal types', "label: 'a' | 'b', count: 1 | 2 | `x${number}`", true],
            ['a nullable part', 'label: string | null, count: number', false],
            ['a boolean part', 'label: string, count: boolean', false],
            ['an unknown part', 'label: string, count: unknown', false],
            ['a callback part', 'label: string, count: () => number', false]
        ])('joins %s with %s', (_label, parameters, joined) => {
            let { output } = compile([
                    `function view(${parameters}) {`,
                    '    return html`<p title="${label}: ${count}">x</p>`;',
                    '}',
                    'let value = null;'
                ].join('\n'));

            expect(output.includes('.interpolate(')).toBe(!joined);
            expect(output.includes('"" + (label) + ": " + (count)')).toBe(joined);
        });

        it('keeps a callback part reactive', async () => {
            let count = signal(0),
                { value } = compile('let value = html`<p title="n${() => read(count)}" data-x="${0}${() => read(count)}">x</p>`;', { count, read });

            let p = mount(value).querySelector('p')!;

            expect([p.title, p.getAttribute('data-x')]).toEqual(['n0', '00']);

            write(count, 2);
            await Promise.resolve();

            expect([p.title, p.getAttribute('data-x')]).toEqual(['n2', '02']);
        });
    });

    describe('specialization', () => {
        it('renders every variant, each folding a different subset of expressions', () => {
            let { output, value } = compile([
                "function view(type: 'a' | 'b', size: 1 | 2, label: string) {",
                '    return html`<p class="${type}" data-size="${size}" title="${type === \'a\' ? \'fixed\' : label}">${size === 1 ? \'one\' : label}</p>`;',
                '}',
                "let value = [view('a', 1, 'L'), view('a', 2, 'L'), view('b', 1, 'L'), view('b', 2, 'L')];"
            ].join('\n'));

            expect(output).toMatch(/\(type as unknown\) === "a"/);

            let rendered = value.map((node: Node) => {
                    let p = mount(node).querySelector('p')!;

                    return [p.className, p.dataset.size, p.title, p.textContent];
                });

            expect(rendered).toEqual([
                ['a', '1', 'fixed', 'one'],
                ['a', '2', 'fixed', 'L'],
                ['b', '1', 'L', 'one'],
                ['b', '2', 'L', 'L']
            ]);
        });

        it('falls back to the generic template for a value outside the union', () => {
            let { value } = compile([
                "function view(type: 'a' | 'b') {",
                '    return html`<p class="${type}">${type}</p>`;',
                '}',
                "let value = view('c' as 'a');"
            ].join('\n'));

            let p = mount(value).querySelector('p')!;

            expect([p.className, p.textContent]).toEqual(['c', 'c']);
        });
    });
});
