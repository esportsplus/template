import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import * as reactivity from '@esportsplus/reactivity';
import * as runtime from '../../src';
import { UNCOMPILED } from '../../src/constants';
import vite from '../../src/compiler/plugins/vite';


const root = process.cwd();

// Every way a module can reach `html`; each consumer renders `<p>` with its own label
const FILES: Record<string, string> = {
    'barrel.ts': [
        "export { html as tag } from '@esportsplus/template';",
        "export * from '@esportsplus/template';",
        "export * as T from '@esportsplus/template';",
        "import { html } from '@esportsplus/template';",
        'export default html;',
        'export const alias = html;'
    ].join('\n'),
    'renamed.ts': "import { tag } from './barrel';\nexport default (label: string) => tag`<p>${label}</p>`;",
    'star.ts': "import { html as h } from './barrel';\nexport default (label: string) => h`<p>${label}</p>`;",
    'namespace.ts': "import { T } from './barrel';\nexport default (label: string) => T.html`<p>${label}</p>`;",
    'nested.ts': "import * as B from './barrel';\nexport default (label: string) => B.T.html`<p>${label}</p>`;",
    'default.ts': "import d from './barrel';\nexport default (label: string) => d`<p>${label}</p>`;",
    'constant.ts': "import { alias } from './barrel';\nexport default (label: string) => alias`<p>${label}</p>`;",
    'keyed.ts': "import * as B from './barrel';\nexport default (label: string) => B.T['html']`<p>${label}</p>`;"
};

let fixtures: string[] = [];


function project(files: Record<string, string>): { directory: string; plugin: ReturnType<typeof vite> } {
    let directory = mkdtempSync(join(root, '.fixture-coverage-')).replace(/\\/g, '/');

    fixtures.push(directory);

    for (let [name, code] of Object.entries(files)) {
        writeFileSync(join(directory, name), code);
    }

    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { module: 'esnext', moduleResolution: 'bundler', strict: true, target: 'esnext', types: [] },
        files: Object.keys(files).map(name => './' + name)
    }));

    let plugin = vite({ root: directory });

    plugin.configResolved({ command: 'build', root: directory });

    return { directory, plugin };
}

// Runs a compiled module whose only imports are namespace imports of the runtime packages
function render(code: string, label: string): string {
    let js = stripTypeScriptTypes(code)
            .replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g, (_, name, source) => `const ${name} = modules[${JSON.stringify(source)}];`)
            .replace(/import[^;]*from\s+['"]\.\/barrel['"];?/g, '')
            .replace(/export default /, 'return '),
        element = document.createElement('div');

    element.append(new Function('modules', js)({ '@esportsplus/reactivity': reactivity, '@esportsplus/template': runtime })(label));

    return element.textContent!;
}


afterEach(() => {
    for (let fixture of fixtures) {
        rmSync(fixture, { force: true, recursive: true });
    }

    fixtures = [];
});


describe('compiler coverage', () => {
    it.each(Object.keys(FILES).filter(name => name !== 'barrel.ts'))('compiles html reached through %s', (name) => {
        let { directory, plugin } = project(FILES),
            output = plugin.transform(FILES[name], directory + '/' + name)!.code;

        expect(output).not.toMatch(/\w`<p>/);
        expect(render(output, name)).toBe(name);
    });

    it('fails the build on a use of html that cannot be compiled, naming the location', () => {
        let files = {
                'escape.ts': "import { html } from '@esportsplus/template';\ndeclare function take(value: unknown): void;\ntake(html);"
            },
            { directory, plugin } = project(files);

        expect(() => plugin.transform(files['escape.ts'], directory + '/escape.ts')).toThrow(/escape\.ts:3:6/);
    });

    it('rejects a bundle chunk that still contains the uncompiled html runtime', () => {
        let { plugin } = project(FILES);

        expect(() => plugin.renderChunk(`throw new Error("html\`\` templates ${UNCOMPILED}")`, { fileName: 'app.js' })).toThrow(/app\.js/);
        expect(plugin.renderChunk('let compiled = template_u1.template(`<p>`);', { fileName: 'app.js' })).toBeNull();
    });

    it('invalidates a consumer when the barrel it compiles through changes', () => {
        let { directory, plugin } = project(FILES),
            dependent = { id: directory + '/renamed.ts' },
            invalidated: unknown[] = [];

        plugin.transform(FILES['renamed.ts'], directory + '/renamed.ts');

        let result = plugin.handleHotUpdate({
            file: directory + '/barrel.ts',
            modules: [],
            server: {
                moduleGraph: {
                    getModulesByFile: (file: string) => file === directory + '/renamed.ts' ? new Set([dependent]) : undefined,
                    invalidateModule: (module: unknown) => invalidated.push(module)
                }
            }
        });

        expect(result).toEqual([dependent]);
        expect(invalidated).toEqual([dependent]);
    });
});
