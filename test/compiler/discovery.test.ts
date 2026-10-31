import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import * as reactivity from '@esportsplus/reactivity';
import * as runtime from '../../src';
import vite from '../../src/compiler/plugins/vite';


// The imports, the expression tagging `<p>${label}</p>`, and, if it is reached through a parameter, that parameter's
// binding and the module it is typed as and passed
type Form = [imports: string, tag: string, parameter?: [binding: string, source: string]];

type Plugin = ReturnType<typeof vite>;


const AsyncFunction = (async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<(label: string) => Node>;


const BARREL = [
    "export { html as tag } from '@esportsplus/template';",
    "export * from '@esportsplus/template';",
    "export * as T from '@esportsplus/template';",
    "import { html } from '@esportsplus/template';",
    'export default html;',
    'export const alias = html;'
].join('\n');

// A parameter can be reassigned, so like a `let` it never holds html: nothing in the module is a site to lower or report
const DESTRUCTURED: Form = ['', 'html', ['{ html }', '@esportsplus/template']];

// Every way a module can reach `html`
const FORMS: Record<string, Form> = {
    'barrel-default': ["import d from './barrel';", 'd'],
    'barrel-renamed': ["import { tag } from './barrel';", 'tag'],
    'barrel-star': ["import { html as h } from './barrel';", 'h'],
    'const-alias': ["import { alias } from './barrel';", 'alias'],
    'destructured': ["import * as B from './barrel';\nconst { html: h } = B.T;", 'h'],
    'destructured-nested': ["import * as B from './barrel';\nconst { T } = B, { html } = T;", 'html'],
    'direct': ["import { html } from '@esportsplus/template';", 'html'],
    'dynamic-destructured': ["const { html } = await import('@esportsplus/template');", 'html'],
    'dynamic-member': ['', "(await import('@esportsplus/template')).html"],
    'import-require': ["import T = require('@esportsplus/template');", 'T.html'],
    'keyed': ["import * as B from './barrel';", "B.T['html']"],
    'multi-hop': ["import { html } from '@esportsplus/template';\nconst a = html, b = a;\nconst c = b;", 'c'],
    'namespace': ["import * as T from '@esportsplus/template';", 'T.html'],
    'namespace-member': ["import { T } from './barrel';", 'T.html'],
    'nested': ["import * as B from './barrel';", 'B.T.html'],
    'nested-const': ["import * as B from './barrel';\nconst T = B.T;", 'T.html'],
    'parameter-member': ['', 'B.tag', ['B', './barrel']],
    'parameter-nested': ['', 'B.T.html', ['B', './barrel']]
};

const STAGE = "import { reactive } from '@esportsplus/reactivity';\nconst state = reactive({ count: 1 });";


let fixtures: string[] = [];


function consumer([imports, tag, parameter]: Form, staged: boolean): string {
    let template = `${tag}\`<p>\${label}</p>\``;

    return [
        imports,
        staged ? STAGE : '',
        parameter
            ? `export default async (label: string) => ((${parameter[0]}: typeof import('${parameter[1]}')) => ${template})(await import('${parameter[1]}'));`
            : `export default async (label: string) => ${template};`,
        staged ? 'export const count = () => state.count;' : ''
    ].join('\n');
}

function project(files: Record<string, string>, command: string = 'build'): { directory: string; plugin: Plugin } {
    let directory = mkdtempSync(join(process.cwd(), '.fixture-discovery-')).replace(/\\/g, '/');

    fixtures.push(directory);

    for (let [name, code] of Object.entries(files)) {
        writeFileSync(join(directory, name), code);
    }

    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { module: 'esnext', moduleResolution: 'bundler', strict: true, target: 'esnext', types: [] },
        files: Object.keys(files).map(name => './' + name)
    }));

    let plugin = vite({ root: directory });

    plugin.configResolved({ command, root: directory, server: {} });

    return { directory, plugin };
}

// Runs a compiled module. Imports hoist, so each becomes a const at the top; the barrel is the runtime under its
// re-exported names, whose html throws if anything still calls it uncompiled.
async function render(code: string, label: string): Promise<string> {
    let hoisted: string[] = [],
        hoist = (text: string) => { hoisted.push(text); return ''; },
        js = stripTypeScriptTypes(
                code.replace(/import\s+(\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\);?/g, (_, name, source) => hoist(`const ${name} = modules[${JSON.stringify(source)}];`))
            )
            .replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g, (_, name, source) => hoist(`const ${name} = modules[${JSON.stringify(source)}];`))
            .replace(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g, (_, names, source) =>
                hoist(`const {${names.replace(/(\w+)\s+as\s+(\w+)/g, '$1: $2')}} = modules[${JSON.stringify(source)}];`))
            .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g, (_, name, source) => hoist(`const ${name} = modules[${JSON.stringify(source)}].default;`))
            .replace(/\bimport\((['"][^'"]+['"])\)/g, 'modules.load($1)')
            .replace(/export const (\w+) =/g, 'const $1 =')
            .replace(/export default /, 'return '),
        modules: Record<string, unknown> = {
            './barrel': { ...runtime, alias: runtime.html, default: runtime.html, T: runtime, tag: runtime.html },
            '@esportsplus/reactivity': reactivity,
            '@esportsplus/template': runtime,
            load: async (source: string) => modules[source]
        },
        element = document.createElement('div'),
        factory = new AsyncFunction('modules', `return (async () => { ${hoisted.join('\n')}\n${js} })();`);

    element.append(await (await factory(modules))(label));

    return element.textContent!;
}

function transform(plugin: Plugin, directory: string, name: string, code: string) {
    return plugin.transform.handler(code, `${directory}/${name}`);
}


afterEach(() => {
    for (let fixture of fixtures) {
        rmSync(fixture, { force: true, recursive: true });
    }

    fixtures = [];
});


describe('compiler site discovery', () => {
    describe.each([['staged', true], ['unstaged', false]] as const)('%s programs', (_label, staged) => {
        it.each(Object.keys(FORMS))('compiles html reached through %s', async (name) => {
            let files = { 'barrel.ts': BARREL, [name + '.ts']: consumer(FORMS[name], staged) },
                { directory, plugin } = project(files),
                output = transform(plugin, directory, name + '.ts', files[name + '.ts'])!.code;

            expect(output).toContain('.template(');
            expect(output).not.toMatch(/(\w|\]|\))`<p>/);

            if (staged) {
                expect(output).not.toContain('reactive({');
            }

            expect(await render(output, name)).toBe(name);
        });

        it('compiles every form in sequence with one plugin, with no false escape', async () => {
            let files: Record<string, string> = { 'barrel.ts': BARREL };

            for (let name of Object.keys(FORMS)) {
                files[name + '.ts'] = consumer(FORMS[name], staged);
            }

            let { directory, plugin } = project(files);

            for (let name of Object.keys(FORMS)) {
                let output = transform(plugin, directory, name + '.ts', files[name + '.ts'])!.code;

                expect(await render(output, name)).toBe(name);
            }
        });

        it('keeps the html import a surviving local alias reads, and removes it otherwise', () => {
            let files = { 'barrel.ts': BARREL, 'aliased.ts': consumer(FORMS['multi-hop'], staged), 'direct.ts': consumer(FORMS['direct'], staged) },
                { directory, plugin } = project(files);

            expect(transform(plugin, directory, 'aliased.ts', files['aliased.ts'])!.code).toMatch(/import \{ html \} from '@esportsplus\/template';/);
            expect(transform(plugin, directory, 'direct.ts', files['direct.ts'])!.code).not.toMatch(/import \{[^}]*html[^}]*\}/);
        });

        it('reports a let alias as an escape', () => {
            let files = {
                    'escape.ts': [
                        "import { html } from '@esportsplus/template';",
                        staged ? STAGE : '',
                        'let h = html;',
                        'export default () => h`<p>x</p>`;',
                        staged ? 'export const count = () => state.count;' : ''
                    ].join('\n')
                },
                { directory, plugin } = project(files);

            expect(() => transform(plugin, directory, 'escape.ts', files['escape.ts'])).toThrow(/escape\.ts:\d+:9/);
        });

        it.each([
            ['a const', 'let h = html;\nexport default () => { const h2 = h; return h2`<p>x</p>`; };'],
            ['a property', 'export default { html };'],
            ['an argument', 'declare function take(value: unknown): void;\ntake(html);']
        ])('reports html passed through %s as an escape', (_label, body) => {
            let files = {
                    'escape.ts': ["import { html } from '@esportsplus/template';", staged ? STAGE : '', body].join('\n')
                },
                { directory, plugin } = project(files);

            expect(() => transform(plugin, directory, 'escape.ts', files['escape.ts'])).toThrow(/is compiled away/);
        });

        it('leaves a tag that shadows html uncompiled', () => {
            let files = {
                    'shadow.ts': [
                        "import { html } from '@esportsplus/template';",
                        staged ? STAGE : '',
                        'type Tag = (strings: TemplateStringsArray, ...values: unknown[]) => string;',
                        'export const shadow = (html: Tag) => html`<i>shadowed</i>`;',
                        'export const local = () => { const html: Tag = (s) => s.join(); return html`<i>local</i>`; };',
                        'export default () => html`<p>compiled</p>`;',
                        staged ? 'export const count = () => state.count;' : ''
                    ].join('\n')
                },
                { directory, plugin } = project(files),
                output = transform(plugin, directory, 'shadow.ts', files['shadow.ts'])!.code;

            expect(output).toContain('html`<i>shadowed</i>`');
            expect(output).toContain('html`<i>local</i>`');
            expect(output).not.toContain('html`<p>compiled</p>`');
        });

        it('leaves html destructured from a module-typed parameter to the runtime', async () => {
            let files = { 'parameter.ts': consumer(DESTRUCTURED, staged) },
                { directory, plugin } = project(files),
                output = transform(plugin, directory, 'parameter.ts', files['parameter.ts'])?.code ?? files['parameter.ts'];

            expect(output).toContain('html`<p>');
            await expect(render(output, 'parameter')).rejects.toThrow(/must be compiled/);
        });
    });

    describe('dev edits', () => {
        it('re-transforms an edited file and its dependent on the new snapshot', () => {
            let files = {
                    'barrel.ts': BARREL,
                    'consumer.ts': consumer(FORMS['const-alias'], true)
                },
                { directory, plugin } = project(files, 'serve'),
                edited = BARREL.replace('export const alias = html;', 'export const alias = (strings: TemplateStringsArray, ...values: unknown[]) => strings.join(String(values));');

            expect(transform(plugin, directory, 'consumer.ts', files['consumer.ts'])!.code).not.toContain('alias`');

            plugin.watchChange(`${directory}/barrel.ts`);
            transform(plugin, directory, 'barrel.ts', edited);

            // No longer html, so nothing to compile and nothing to escape
            let next = transform(plugin, directory, 'consumer.ts', files['consumer.ts']);

            expect(next === null || next.code.includes('alias`<p>')).toBe(true);

            plugin.watchChange(`${directory}/barrel.ts`);
            transform(plugin, directory, 'barrel.ts', BARREL);

            expect(transform(plugin, directory, 'consumer.ts', files['consumer.ts'])!.code).not.toContain('alias`');
        });

        it('re-transforms an edited consumer, staged, and keeps its dependency tracked', () => {
            let files = {
                    'barrel.ts': BARREL,
                    'consumer.ts': consumer(FORMS['barrel-renamed'], true)
                },
                { directory, plugin } = project(files, 'serve');

            transform(plugin, directory, 'consumer.ts', files['consumer.ts']);
            plugin.watchChange(`${directory}/consumer.ts`);

            let output = transform(plugin, directory, 'consumer.ts', files['consumer.ts'].replace('<p>', '<p data-edit="1">'))!.code;

            expect(output).toContain('data-edit');
            expect(output).not.toContain('tag`');

            let dependent = { id: `${directory}/consumer.ts` },
                result = plugin.handleHotUpdate({
                    file: `${directory}/barrel.ts`,
                    modules: [],
                    server: {
                        moduleGraph: {
                            getModulesByFile: (file: string) => file === dependent.id ? new Set([dependent]) : undefined,
                            invalidateModule: () => {}
                        }
                    }
                });

            expect(result).toEqual([dependent]);
        });
    });

    describe('vite ids', () => {
        let files = { 'direct.ts': consumer(FORMS['direct'], true), 'module.mts': consumer(FORMS['direct'], false), 'common.cts': consumer(FORMS['direct'], false) };

        it('transforms an id with a ?worker_file query as the file it names', () => {
            let { directory, plugin } = project(files);

            expect(plugin.transform.handler(files['direct.ts'], `${directory}/direct.ts?worker_file&type=module`)!.code).toContain('.template(');
        });

        it('does not wrap a queried module for HMR', () => {
            let { directory, plugin } = project({ 'view.ts': "import { html } from '@esportsplus/template';\nexport default html`<p>x</p>`;" }, 'serve');

            expect(plugin.transform.handler("import { html } from '@esportsplus/template';\nexport default html`<p>x</p>`;", `${directory}/view.ts`)!.code).toContain('import.meta.hot');
            expect(plugin.transform.handler("import { html } from '@esportsplus/template';\nexport default html`<p>x</p>`;", `${directory}/view.ts?worker_file`)!.code).not.toContain('import.meta.hot');
        });

        it('filters ids for Vite before calling in', () => {
            let { plugin } = project(files),
                { exclude, include } = plugin.transform.filter.id,
                accepts = (id: string) => include.test(id) && !exclude.some(regex => regex.test(id));

            for (let id of ['/a/b.ts', '/a/b.tsx', '/a/b.js', '/a/b.jsx', '/a/b.mts', '/a/b.cts', '/a/b.mjs', '/a/b.cjs', '/a/b.ts?worker_file&type=module', 'C:\\a\\b.ts']) {
                expect(accepts(id), id).toBe(true);
            }

            for (let id of ['/a/b.scss', '/a/b.d.ts.map', '/a/node_modules/c/d.ts', 'C:\\a\\node_modules\\c\\d.ts', '\0virtual:b.ts', '/a/b.tsx.css', '/a/b.html']) {
                expect(accepts(id), id).toBe(false);
            }
        });

        it.each([
            ['a virtual id', (directory: string) => `\0virtual:${directory}/direct.ts`],
            ['an id under node_modules', (directory: string) => `${directory}/node_modules/pkg/direct.ts`],
            ['a ?raw asset import', (directory: string) => `${directory}/direct.ts?raw`],
            ['a ?url asset import', (directory: string) => `${directory}/direct.ts?url`],
            ['a non-script id', (directory: string) => `${directory}/style.scss`]
        ])('leaves %s alone', (_label, id) => {
            let { directory, plugin } = project(files);

            expect(plugin.transform.handler(files['direct.ts'], id(directory))).toBeNull();
        });

        // The upstream @esportsplus/typescript Vite plugin only takes .[tj]sx? ids, so these stay untransformed until it does
        it.each(['module.mts', 'common.cts'])('leaves %s to the upstream gate', (name) => {
            let { directory, plugin } = project(files);

            expect(plugin.transform.handler(files[name as keyof typeof files], `${directory}/${name}`)).toBeNull();
        });
    });
});
