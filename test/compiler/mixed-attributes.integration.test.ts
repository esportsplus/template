import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root as reactiveRoot } from '@esportsplus/reactivity';
import * as reactivity from '@esportsplus/reactivity';
import * as runtime from '../../src';
import vite from '../../src/compiler/plugins/vite';


const require = createRequire(import.meta.url);
const root = process.cwd();
const factorySource = [
    "import { html } from '@esportsplus/template';",
    "import { reactive } from '@esportsplus/reactivity';",
    "const factory = (type: 'checkbox' | 'radio' | 'switch') => {",
    '    function component() {',
    '        const state = reactive({ active: false });',
    '        return html`<button class="${type === "radio" ? "checkbox checkbox--radio" : type} ${() => state.active && "--active"}" title="${type} ${() => state.active ? "on" : "off"}" onclick=${() => { state.active = !state.active; }}>${type}${type === "checkbox" && html`<span data-indicator="check"></span>`}</button>`;',
    '    }',
    '    return component;',
    '};',
    'export { factory };'
].join('\n');
let fixtures: string[] = [];

// Execute the real plugin output against the DOM/runtime. This controlled module
// fixture uses namespace/named imports and one named or default export only.
function execute(code: string, modules: Record<string, unknown>, named = false): any {
    let js = stripTypeScriptTypes(code)
        .replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g, (_, name, source) => `const ${name} = modules[${JSON.stringify(source)}];`)
        .replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g, (_, names, source) => `const { ${names} } = modules[${JSON.stringify(source)}];`)
        .replace(/export\s*\{\s*factory\s*\};?/, '')
        .replace(/export default /, 'return ');
    return new Function('modules', js + (named ? '\nreturn { factory };' : ''))(modules);
}

afterEach(() => {
    for (let fixture of fixtures) {
        if (dirname(resolve(fixture)) !== resolve(root)) throw new Error('Unexpected fixture path');
        rmSync(fixture, { force: true, recursive: true });
    }
    fixtures = [];
    document.body.replaceChildren();
});

describe('mixed attributes through compiler plugins', () => {
    it.each(['vite', 'tsc'])('%s preserves imported factory variants and live bindings', async mode => {
        let fixture = mkdtempSync(join(root, '.fixture-mixed-'));
        fixtures.push(fixture);
        let sources: Record<string, string> = { factory: factorySource };
        for (let type of ['checkbox', 'radio', 'switch']) sources[type] = `import { factory } from './factory'; export default factory('${type}');`;
        for (let [name, source] of Object.entries(sources)) writeFileSync(join(fixture, name + '.ts'), source);
        writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify({
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler', target: 'esnext', strict: true, skipLibCheck: true, types: [] },
            files: Object.keys(sources).map(name => './' + name + '.ts')
        }));

        let outputs: Record<string, string> = {};
        if (mode === 'vite') {
            let plugin = vite({ root: fixture });
            plugin.configResolved({ root: fixture, command: 'build' });
            for (let [name, source] of Object.entries(sources)) {
                outputs[name] = plugin.transform(source, join(fixture, name + '.ts').replace(/\\/g, '/'))?.code ?? source;
            }
        }
        else {
            let installed = join(fixture, 'node_modules/@esportsplus/template');
            mkdirSync(installed, { recursive: true });
            cpSync(join(root, 'build'), join(installed, 'build'), { recursive: true });
            cpSync(join(root, 'package.json'), join(installed, 'package.json'));
            writeFileSync(join(fixture, 'package.json'), JSON.stringify({ type: 'module' }));
            writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify({
                compilerOptions: {
                    module: 'esnext', moduleResolution: 'bundler', target: 'esnext', strict: true,
                    skipLibCheck: true, outDir: './out', types: [],
                    plugins: [{ transform: require.resolve('@esportsplus/template/compiler/tsc') }]
                }, files: Object.keys(sources).map(name => './' + name + '.ts')
            }));
            let env = { ...process.env };
            delete env.VITEST;
            let result = spawnSync(process.execPath, [join(dirname(require.resolve('@esportsplus/typescript/package.json')), 'bin/tsc'), '-p', join(fixture, 'tsconfig.json')], {
                cwd: fixture, encoding: 'utf8', env, timeout: 30000, windowsHide: true
            });
            expect(result.error).toBeUndefined();
            expect(result.status, result.stdout + result.stderr).toBe(0);
            for (let name of Object.keys(sources)) outputs[name] = readFileSync(join(fixture, 'out', name + '.js'), 'utf8');
        }

        // Static class text must exist in cloned HTML, not just in a runtime test.
        for (let name of ['checkbox', 'checkbox checkbox--radio', 'switch']) {
            expect(outputs.factory).toContain(`class="${name} `);
        }
        expect(outputs.factory).not.toContain('html`');
        let factoryModule = execute(outputs.factory, { '@esportsplus/template': runtime, '@esportsplus/reactivity': reactivity }, true);

        for (let type of ['checkbox', 'radio', 'switch']) {
            let component = execute(outputs[type], { './factory': factoryModule }),
                dispose = () => {},
                fragment = reactiveRoot(stop => {
                    dispose = stop;
                    return component();
                }),
                element = fragment.firstChild as HTMLButtonElement,
                base = type === 'radio' ? 'checkbox checkbox--radio' : type;
            document.body.append(fragment);
            expect(element.className.trim()).toBe(base);
            expect(element.title).toBe(type + ' off');
            expect(element.textContent).toBe(type);
            expect(element.querySelector('[data-indicator]') !== null).toBe(type === 'checkbox');
            element.click(); await new Promise(resolve => requestAnimationFrame(resolve));
            expect(element.classList.contains('--active')).toBe(true);
            expect(element.title).toBe(type + ' on');
            element.click(); await new Promise(resolve => requestAnimationFrame(resolve));
            expect(element.className.trim()).toBe(base);
            expect(element.title).toBe(type + ' off');
            dispose(); element.remove();
        }
    }, 30000);

    it('preserves Vite HMR wrapping for a specialized factory export', () => {
        let fixture = mkdtempSync(join(root, '.fixture-mixed-'));
        fixtures.push(fixture);
        let path = join(fixture, 'factory.ts'),
            source = factorySource + '\nexport default factory("checkbox");';
        writeFileSync(path, source);
        writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'esnext', moduleResolution: 'bundler', target: 'esnext', strict: true, types: [] }, files: ['./factory.ts'] }));
        let plugin = vite({ root: fixture });
        plugin.configResolved({ root: fixture, command: 'serve', server: {} });
        let output = plugin.transform(source, path.replace(/\\/g, '/'))!.code;
        expect(output).toContain('import.meta.hot.accept(');
        expect(output).toContain('.factory(');
        expect(output).toContain('class="checkbox checkbox--radio ');
        expect(output).not.toContain('html`');
    });
});
