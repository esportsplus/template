// Compiler corpus bench: times findTemplateArtifacts + generateCode per corpus file with a type checker,
// counts the checker queries that reach the checker (the ones cached() did not answer), and can emit
// every file's full transform for an output-equality diff between two compilers.
//
// usage: node bench/compiler/corpus.mjs [--package DIR] [--emit DIR] [--iterations N] [--json FILE]
//
// --package is a template package dir holding `package.json` and a built `build/` (default: this repo,
// see bench/compiled/snapshot.mjs).
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { coordinator, languageService } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';


const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(HERE, '../..');


function median(values) {
    let sorted = [...values].sort((a, b) => a - b);

    return sorted[sorted.length >> 1];
}

// Counts every call that reaches the checker, by method
function counting(checker, counts) {
    return new Proxy(checker, {
        get(target, key) {
            let value = Reflect.get(target, key);

            if (typeof value !== 'function') {
                return value;
            }

            return (...args) => {
                counts.set(key, (counts.get(key) || 0) + 1);

                return value.apply(target, args);
            };
        }
    });
}


let { values } = parseArgs({
        options: {
            emit: { type: 'string' },
            iterations: { default: '20', type: 'string' },
            json: { type: 'string' },
            package: { default: ROOT, type: 'string' }
        }
    }),
    iterations = Number(values.iterations),
    pkg = resolve(values.package),
    label = pkg === ROOT ? 'current' : pkg.split(/[\\/]/).pop(),
    workspace = join(ROOT, 'node_modules/.cache/template-bench/corpus', label.replace(/[^\w-]/g, '_')),
    files = readdirSync(join(HERE, 'corpus')).filter((f) => f.endsWith('.ts')).sort();

rmSync(workspace, { force: true, recursive: true });
mkdirSync(join(workspace, 'node_modules/@esportsplus/template'), { recursive: true });
cpSync(join(pkg, 'build'), join(workspace, 'node_modules/@esportsplus/template/build'), { recursive: true });
cpSync(join(pkg, 'package.json'), join(workspace, 'node_modules/@esportsplus/template/package.json'));
cpSync(join(HERE, 'corpus'), join(workspace, 'src'), { recursive: true });
writeFileSync(join(workspace, 'package.json'), JSON.stringify({ name: 'corpus-bench', private: true, type: 'module' }));
writeFileSync(join(workspace, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
        lib: ['dom', 'dom.iterable', 'es2024'],
        module: 'esnext',
        moduleResolution: 'bundler',
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: 'es2024',
        types: []
    },
    include: ['src']
}));

let build = join(workspace, 'node_modules/@esportsplus/template/build/compiler'),
    { generateCode } = await import(pathToFileURL(join(build, 'codegen.js')).href),
    { findTemplateArtifacts } = await import(pathToFileURL(join(build, 'ts-parser.js')).href),
    template = (await import(pathToFileURL(join(build, 'index.js')).href)).default,
    config = join(workspace, 'tsconfig.json'),
    opened = languageService.open(config),
    { checker, program } = opened.project,
    counts = new Map(),
    // One pass over the corpus as a build makes it: every file transformed once against the same program
    counted = counting(checker, counts),
    results = [],
    total = 0;

try {
    for (let i = 0, n = files.length; i < n; i++) {
        let path = join(workspace, 'src', files[i]),
            sourceFile = program.getSourceFile(path),
            times = [];

        if (!sourceFile) {
            throw new Error(`Corpus: '${path}' is not in the program!`);
        }

        generateCode(findTemplateArtifacts(sourceFile, counted, program), sourceFile, counted, program);

        for (let j = 0; j < 3; j++) {
            generateCode(findTemplateArtifacts(sourceFile, checker, program), sourceFile, checker);
        }

        for (let j = 0; j < iterations; j++) {
            let start = performance.now();

            generateCode(findTemplateArtifacts(sourceFile, checker, program), sourceFile, checker);
            times.push(performance.now() - start);
        }

        let ms = median(times);

        results.push({ file: files[i], ms });
        total += ms;

        if (values.emit) {
            let result = coordinator.transform(
                    [reactivity, template],
                    sourceFile.getFullText(),
                    sourceFile,
                    { checker, configPath: config, program },
                    workspace,
                    new Map()
                ),
                out = resolve(values.emit);

            mkdirSync(out, { recursive: true });
            writeFileSync(join(out, files[i]), result.code);
        }
    }
}
finally {
    opened.dispose();
}

let pad = Math.max(...files.map((f) => f.length));

console.log(`\n[${label}] ${files.length} files, median of ${iterations}\n`);

for (let i = 0, n = results.length; i < n; i++) {
    console.log(`${results[i].file.padEnd(pad)}  ${results[i].ms.toFixed(3).padStart(9)}ms`);
}

console.log(`${'total'.padEnd(pad)}  ${total.toFixed(3).padStart(9)}ms\n\nchecker calls (one pass over the corpus)`);

let calls = 0;

for (let [key, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    calls += count;
    console.log(`${String(key).padEnd(pad)}  ${String(count).padStart(9)}`);
}

console.log(`${'total'.padEnd(pad)}  ${String(calls).padStart(9)}\n`);

if (values.json) {
    mkdirSync(dirname(resolve(values.json)), { recursive: true });
    writeFileSync(resolve(values.json), JSON.stringify({ calls: Object.fromEntries(counts), label, results, total }, null, 4));
}
