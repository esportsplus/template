// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';


const require = createRequire(import.meta.url),
    root = resolve(import.meta.dirname, '../..'),
    tsc = join(dirname(require.resolve('@esportsplus/typescript/package.json')), 'bin/tsc');


let fixture: string;


afterEach(() => {
    if (fixture) {
        rmSync(fixture, { force: true, recursive: true });
    }
});


describe('compiler/tsc', () => {
    it.each(['direct', './app', '~/app'])('elides compiled html and reactive imports from %s', (module) => {
        fixture = mkdtempSync(join(root, '.fixture-tsc-'));

        let installed = join(fixture, 'node_modules/@esportsplus/template');

        mkdirSync(installed, { recursive: true });
        cpSync(join(root, 'build'), join(installed, 'build'), { recursive: true });
        cpSync(join(root, 'package.json'), join(installed, 'package.json'));
        writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'compiler-tsc-fixture', type: 'module' }));
        writeFileSync(join(fixture, 'app.ts'), [
            "export { html } from '@esportsplus/template';",
            "export { reactive } from '@esportsplus/reactivity';"
        ].join('\n'));
        writeFileSync(join(fixture, 'consumer.ts'), [
            module === 'direct'
                ? "import { html } from '@esportsplus/template';\nimport { reactive } from '@esportsplus/reactivity';"
                : `import { html, reactive } from '${module}';`,
            "const state = reactive({ query: '' });",
            'export default html`<div>${state.query}</div>`;'
        ].join('\n'));
        writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify({
            compilerOptions: {
                module: 'esnext',
                moduleResolution: 'bundler',
                noUnusedLocals: true,
                noUnusedParameters: true,
                outDir: './out',
                paths: { '~/*': ['./*'] },
                plugins: [{ transform: require.resolve('@esportsplus/template/compiler/tsc') }],
                skipLibCheck: true,
                strict: true,
                target: 'esnext',
                types: []
            },
            files: ['./consumer.ts']
        }));

        let env = { ...process.env };

        delete env.VITEST;

        let result = spawnSync(process.execPath, [tsc, '-p', join(fixture, 'tsconfig.json')], {
            cwd: fixture,
            encoding: 'utf8',
            env,
            timeout: 30000,
            windowsHide: true
        });

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);

        let output = readFileSync(join(fixture, 'out/consumer.js'), 'utf8');

        expect(output).toContain('.template(');
        expect(output).not.toContain('html`');
        expect(output).not.toContain('reactive(');
        expect(output).not.toMatch(/import\s*\{[^}]*(?:html|reactive)[^}]*\}/);
    });
});
