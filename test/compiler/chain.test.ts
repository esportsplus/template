// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import vite from '../../src/compiler/plugins/vite';


const CORPUS = join(import.meta.dirname, '../../bench/compiler/corpus');

const FIXTURES = join(import.meta.dirname, 'chain');


let directory = mkdtempSync(join(process.cwd(), '.fixture-chain-')).replace(/\\/g, '/'),
    files = new Map<string, string>();


function collect(from: string, prefix: string): void {
    let names = readdirSync(from).filter((name) => name.endsWith('.ts')).sort();

    for (let i = 0, n = names.length; i < n; i++) {
        files.set(prefix + names[i], readFileSync(join(from, names[i]), 'utf8').replace(/\r\n/g, '\n'));
    }
}


collect(CORPUS, 'corpus-');
collect(FIXTURES, 'chain-');

for (let [name, code] of files) {
    writeFileSync(join(directory, name), code);
}

writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
        lib: ['dom', 'dom.iterable', 'es2024'],
        module: 'esnext',
        moduleResolution: 'bundler',
        skipLibCheck: true,
        strict: true,
        target: 'es2024',
        types: []
    },
    files: [...files.keys()].map((name) => './' + name)
}));


afterAll(() => {
    rmSync(directory, { force: true, recursive: true });
});


// The whole Vite chain (hmr, reactivity, template) over every corpus module, as a production build
// runs it: the compiled output of each is pinned byte for byte
describe('compiler chain output', () => {
    let plugin = vite({ root: directory });

    plugin.configResolved({ command: 'build', root: directory });

    it.each([...files.keys()])('compiles %s', async (name) => {
        let code = files.get(name)!,
            result = plugin.transform.handler.call(undefined, code, directory + '/' + name);

        await expect(result?.code ?? code).toMatchFileSnapshot(join(FIXTURES, 'output', name.replace(/\.ts$/, '.txt')));
    }, 60000);
});
