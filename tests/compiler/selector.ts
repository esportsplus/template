import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';

import transform from '../../src/compiler';


function createContext(source: string) {
    let sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true);

    return { checker: undefined, sourceFile };
}

// Checker-backed context so `read` identity resolves through imports.includes rather than the
// name-match fallback — the only harness that can distinguish a shadowed `read` from the import
function createProgramContext(source: string) {
    let compilerOptions: ts.CompilerOptions = {
            lib: ['lib.es2020.d.ts'],
            noEmit: true,
            strict: true,
            target: ts.ScriptTarget.ES2020
        },
        host = ts.createCompilerHost(compilerOptions),
        originalFileExists = host.fileExists,
        originalReadFile = host.readFile;

    host.readFile = (fileName: string) => fileName === 'test.ts' ? source : originalReadFile.call(host, fileName);
    host.fileExists = (fileName: string) => fileName === 'test.ts' ? true : originalFileExists.call(host, fileName);

    let program = ts.createProgram(['test.ts'], compilerOptions, host),
        checker = program.getTypeChecker(),
        sourceFile = program.getSourceFile('test.ts')!;

    return { checker, sourceFile };
}

function compile(ctx: ReturnType<typeof createContext> | ReturnType<typeof createProgramContext>) {
    let empty = ts.createSourceFile('', '', ts.ScriptTarget.Latest),
        result = transform.transform(ctx);

    return {
        code: (result.replacements ?? []).map((replacement) => replacement.generate(empty)).join('\n'),
        imports: result.imports ?? []
    };
}


describe('compiler/selector rewrite', () => {
    describe('=== rewrite (a)', () => {
        it('rewrites a class-binding selection comparison to signal.selector(SIG, KEY)', () => {
            let { code } = compile(createContext(
                "let x = html`<div class=${() => read(sel) === row.id ? 'danger' : ''}>y</div>`;"
            ));

            expect(code).toContain('signal.selector(sel, row.id)');
        });

        it('drops the original read(sel) === row.id comparison from the output', () => {
            let { code } = compile(createContext(
                "let x = html`<div class=${() => read(sel) === row.id ? 'danger' : ''}>y</div>`;"
            ));

            expect(code).not.toContain('read(sel) === row.id');
        });

        it('preserves operand order when the key precedes the read call', () => {
            let { code } = compile(createContext(
                "let x = html`<div class=${() => row.id === read(sel) ? 'danger' : ''}>y</div>`;"
            ));

            expect(code).toContain('signal.selector(sel, row.id)');
            expect(code).not.toContain('read(sel)');
        });
    });

    describe('!== negated rewrite (b)', () => {
        it('emits a negated !signal.selector(SIG, KEY) for strict-inequality', () => {
            let { code } = compile(createContext(
                "let x = html`<div class=${() => read(sel) !== row.id ? 'a' : 'b'}>y</div>`;"
            ));

            expect(code).toContain('!signal.selector(sel, row.id)');
            expect(code).not.toContain('read(sel) !== row.id');
        });
    });

    describe('signal import intent (c)', () => {
        it('injects a signal import intent from @esportsplus/reactivity when a rewrite fired', () => {
            let { imports } = compile(createContext(
                "let x = html`<div class=${() => read(sel) === row.id ? 'danger' : ''}>y</div>`;"
            ));

            let intent = imports.find((i) => i.package === '@esportsplus/reactivity' && (i.add ?? []).includes('signal'));

            expect(intent).toBeDefined();
        });

        it('injects no signal import intent when no rewrite fired', () => {
            let { imports } = compile(createContext(
                'let x = html`<div class=${cls}>text</div>`;'
            ));

            let intent = imports.find((i) => (i.add ?? []).includes('signal'));

            expect(intent).toBeUndefined();
        });
    });

    describe('shadowed / local read guard (d)', () => {
        it('rewrites when a checker resolves read to the @esportsplus/reactivity import', () => {
            let { code } = compile(createProgramContext([
                "import { html } from '@esportsplus/template';",
                "import { read } from '@esportsplus/reactivity';",
                'declare const sel: any;',
                'declare const row: { id: number };',
                "let x = html`<div class=${() => read(sel) === row.id ? 'danger' : ''}>y</div>`;"
            ].join('\n')));

            expect(code).toContain('signal.selector(sel, row.id)');
        });

        it('does NOT rewrite a shadowed local read even inside an Effect arrow', () => {
            let { code } = compile(createProgramContext([
                "import { html } from '@esportsplus/template';",
                'declare const sel: any;',
                'declare const row: { id: number };',
                'function read(value: any): any { return value; }',
                "let x = html`<div class=${() => read(sel) === row.id ? 'danger' : ''}>y</div>`;"
            ].join('\n')));

            expect(code).not.toContain('signal.selector');
            expect(code).toContain('read(sel) === row.id');
        });
    });

    describe('non-observer position guard (e)', () => {
        it('does NOT rewrite a bare read(x) === k node slot outside an Effect arrow', () => {
            let { code } = compile(createContext(
                'let x = html`<div>${read(sel) === row.id}</div>`;'
            ));

            expect(code).not.toContain('signal.selector');
            expect(code).toContain('read(sel) === row.id');
        });
    });

    describe('lowered ReactiveObject form (f)', () => {
        it('rewrites the read(obj.key) === k canonical lowered shape', () => {
            let { code } = compile(createContext(
                "let x = html`<div class=${() => read(obj.id) === row.id ? 'x' : ''}>y</div>`;"
            ));

            expect(code).toContain('signal.selector(obj.id, row.id)');
            expect(code).not.toContain('read(obj.id) === row.id');
        });
    });
});
