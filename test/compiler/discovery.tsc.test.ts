// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { languageService } from '@esportsplus/typescript/compiler';
import type { TransformContext } from '@esportsplus/typescript/compiler';
import transform, { compiler } from '../../src/compiler';


// The imports, the tag, and, if it is reached through a parameter, that parameter's binding and the module it is
// typed as and passed
type Form = [imports: string, tag: string, parameter?: [binding: string, source: string]];


const require = createRequire(import.meta.url),
    root = resolve(import.meta.dirname, '../..'),
    tsc = join(dirname(require.resolve('@esportsplus/typescript/package.json')), 'bin/tsc');

const BARREL = [
    "export { html as tag } from '@esportsplus/template';",
    "export * as T from '@esportsplus/template';",
    "import { html } from '@esportsplus/template';",
    'export default html;',
    'export const alias = html;'
].join('\n');

// A parameter can be reassigned, so like a `let` it never holds html: nothing in the module is a site to lower or report
const DESTRUCTURED: Form = ['', 'html', ['{ html }', '@esportsplus/template']];

// Each consumer also builds reactive state, so reactivity edits it and the template plugin runs on a staged program
const FORMS: Record<string, Form> = {
    'barrel-default': ["import d from './barrel';", 'd'],
    'barrel-renamed': ["import { tag } from './barrel';", 'tag'],
    'const-alias': ["import { alias } from './barrel';", 'alias'],
    'destructured': ["import * as B from './barrel';\nconst { html: h } = B.T;", 'h'],
    'direct': ["import { html } from '@esportsplus/template';", 'html'],
    'dynamic-destructured': ["const { html } = await import('@esportsplus/template');", 'html'],
    'dynamic-member': ['', "(await import('@esportsplus/template')).html"],
    'keyed': ["import * as B from './barrel';", "B.T['html']"],
    'namespace': ["import * as T from '@esportsplus/template';", 'T.html'],
    'nested': ["import * as B from './barrel';", 'B.T.html'],
    'nested-const': ["import * as B from './barrel';\nconst T = B.T;", 'T.html'],
    'parameter-member': ['', 'B.tag', ['B', './barrel']],
    'parameter-nested': ['', 'B.T.html', ['B', './barrel']]
};


let fixtures: string[] = [];


function build(files: Record<string, string>) {
    let fixture = mkdtempSync(join(root, '.fixture-tsc-discovery-')),
        installed = join(fixture, 'node_modules/@esportsplus/template');

    fixtures.push(fixture);
    mkdirSync(installed, { recursive: true });
    cpSync(join(root, 'build'), join(installed, 'build'), { recursive: true });
    cpSync(join(root, 'package.json'), join(installed, 'package.json'));
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'compiler-tsc-discovery', type: 'module' }));

    for (let [name, code] of Object.entries(files)) {
        writeFileSync(join(fixture, name), code);
    }

    writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
            module: 'esnext',
            moduleResolution: 'bundler',
            outDir: './out',
            plugins: [{ transform: require.resolve('@esportsplus/template/compiler/tsc') }],
            skipLibCheck: true,
            strict: true,
            target: 'esnext',
            types: []
        },
        files: Object.keys(files).map(name => './' + name)
    }));

    let env = { ...process.env };

    delete env.VITEST;

    let result = spawnSync(process.execPath, [tsc, '-p', join(fixture, 'tsconfig.json')], {
            cwd: fixture,
            encoding: 'utf8',
            env,
            timeout: 60000,
            windowsHide: true
        });

    return {
        output: (name: string) => readFileSync(join(fixture, 'out', name.replace(/\.ts$/, '.js')), 'utf8'),
        result
    };
}

function consumer([imports, tag, parameter]: Form): string {
    let template = `${tag}\`<p>\${label}</p>\``;

    return [
        imports,
        "import { reactive } from '@esportsplus/reactivity';",
        'const state = reactive({ count: 1 });',
        parameter
            ? `export default async (label: string) => ((${parameter[0]}: typeof import('${parameter[1]}')) => ${template})(await import('${parameter[1]}'));`
            : `export default (label: string) => ${template};`,
        'export const count = () => state.count;'
    ].join('\n');
}


afterAll(() => {
    for (let fixture of fixtures) {
        rmSync(fixture, { force: true, recursive: true });
    }
});


describe('compiler site discovery through tsc', () => {
    describe('several staged files in one build', () => {
        let files: Record<string, string> = { 'barrel.ts': BARREL },
            built: ReturnType<typeof build>;

        for (let [name, form] of Object.entries(FORMS)) {
            files[name + '.ts'] = consumer(form);
        }

        files['parameter-destructured.ts'] = consumer(DESTRUCTURED);

        beforeAll(() => {
            built = build(files);
        }, 60000);

        it('builds', () => {
            expect(built.result.error).toBeUndefined();
            expect(built.result.status, built.result.stdout + built.result.stderr).toBe(0);
        });

        it.each(Object.keys(FORMS))('compiles html reached through %s', (name) => {
            let output = built.output(name + '.ts');

            expect(output).toContain('.template(');
            expect(output).not.toMatch(/(\w|\]|\))`<p>/);
            expect(output).not.toContain('reactive({');
        });

        it('leaves html destructured from a module-typed parameter to the runtime', () => {
            let output = built.output('parameter-destructured.ts');

            expect(output).toMatch(/html\s*`<p>/);
            expect(output).not.toContain('reactive({');
        });
    });

    it('fails the build on a use of html that cannot be compiled, naming the location', () => {
        let { result } = build({
                'escape.ts': [
                    "import { html } from '@esportsplus/template';",
                    "import { reactive } from '@esportsplus/reactivity';",
                    'const state = reactive({ count: 1 });',
                    'let h = html;',
                    'export const count = () => state.count + String(h);'
                ].join('\n')
            });

        // Staged, the line is the staged code's, which reactivity's edits moved
        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toMatch(/escape\.ts:\d+:9 {2}h = html/);
    }, 60000);
});

describe('compiler removal reporting', () => {
    const SOURCE = [
        "import { html } from '@esportsplus/template';",
        'export const panel = () => html`<div onconnect=${(element: HTMLElement) => {',
        '    element.remove();',
        '}}></div>`;'
    ].join('\n');

    function context(): TransformContext {
        let { checker, program, sourceFile } = languageService.scratch(root + '/removal-report.ts', SOURCE);

        return { checker, code: SOURCE, program, shared: new Map(), sourceFile };
    }

    it('reports removals to the callback it was given', () => {
        let found: unknown[][] = [],
            result = compiler((removals) => { found.push(removals); }).transform(context());

        expect(result.replacements?.length).toBeGreaterThan(0);
        expect(found).toHaveLength(1);
        expect(found[0]).toHaveLength(1);
    });

    it('compiles without looking for removals when given no callback, as the tsc path is', () => {
        let result = transform.transform(context());

        expect(result.replacements?.length).toBeGreaterThan(0);
        expect(result.prepend?.length).toBeGreaterThan(0);
    });
});
