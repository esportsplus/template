import { afterAll, test } from 'vitest';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coordinator, languageService } from '@esportsplus/typescript/compiler';

import reactivity from '@esportsplus/reactivity/compiler';
import template from '../../src/compiler';


const CORPUS = join(import.meta.dirname, 'corpus');

const WORKSPACE = join(import.meta.dirname, '../../.tmp/bench-chain').replace(/\\/g, '/');


let config = WORKSPACE + '/tsconfig.json',
    files = new Map<string, string>(),
    names = readdirSync(CORPUS).filter((name) => name.endsWith('.ts')).sort(),
    revision = 0;


rmSync(WORKSPACE, { force: true, recursive: true });
mkdirSync(WORKSPACE, { recursive: true });

for (let i = 0, n = names.length; i < n; i++) {
    let code = readFileSync(join(CORPUS, names[i]), 'utf8');

    files.set(WORKSPACE + '/' + names[i], code);
    writeFileSync(join(WORKSPACE, names[i]), code);
}

writeFileSync(config, JSON.stringify({
    compilerOptions: {
        lib: ['dom', 'dom.iterable', 'es2024'],
        module: 'esnext',
        moduleResolution: 'bundler',
        skipLibCheck: true,
        strict: true,
        target: 'es2024',
        types: []
    },
    files: names.map((name) => './' + name)
}));


// Every pass edits every module, so each runs against a program no checker cache has seen: the
// cost a production build pays per module, tsgo round-trips included
function pass(): void {
    let updates = new Map<string, string>();

    revision++;

    for (let [path, code] of files) {
        updates.set(path, code + '\n// ' + revision + '\n');
    }

    let { checker, program } = languageService.updateMany(config, updates),
        shared = new Map();

    for (let [path, code] of updates) {
        coordinator.transform([reactivity, template], code, program.getSourceFile(path)!, { checker, program }, WORKSPACE, shared);
    }
}


afterAll(() => {
    languageService.dispose(config);
    rmSync(WORKSPACE, { force: true, recursive: true });
});


test('compiler — reactivity + template through coordinator.transform (30 corpus modules)', async ({ bench }) => {
    await bench('corpus pass on a fresh program', pass).run({ iterations: 20, time: 0, warmupIterations: 2, warmupTime: 0 });
});
