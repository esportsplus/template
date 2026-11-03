import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { coordinator, languageService } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';


const CHROME_PATHS = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(HERE, '../..');

const STORAGE = join(homedir(), '.claude/storage/template-bench');


function esbuild() {
    // Resolved through vitest -> vite so the repo needs no direct esbuild dependency
    let root = createRequire(join(ROOT, 'package.json')),
        vitest = createRequire(realpathSync(root.resolve('vitest'))),
        vite = createRequire(realpathSync(vitest.resolve('vite')));

    return vite('esbuild');
}

function table(results) {
    let pad = 0;

    for (let i = 0, n = results.length; i < n; i++) {
        if (results[i].name.length > pad) {
            pad = results[i].name.length;
        }
    }

    let lines = [`${'benchmark'.padEnd(pad)}  ${'median'.padStart(10)}  ${'script'.padStart(10)}  ${'mean'.padStart(10)}  ${'min'.padStart(10)}  ${'max'.padStart(10)}`];

    for (let i = 0, n = results.length; i < n; i++) {
        let r = results[i];

        lines.push(`${r.name.padEnd(pad)}  ${r.median.toFixed(2).padStart(8)}ms  ${r.script.toFixed(2).padStart(8)}ms  ${r.mean.toFixed(2).padStart(8)}ms  ${r.min.toFixed(2).padStart(8)}ms  ${r.max.toFixed(2).padStart(8)}ms`);
    }

    return lines.join('\n');
}

// The app compiled by the template package under test: its compiler lowers the templates and its runtime runs them.
// The package is copied into a workspace whose node_modules resolve everything else from this repo.
async function compile(pkg, workspace) {
    let app = join(workspace, 'app.ts'),
        config = join(workspace, 'tsconfig.json'),
        target = join(workspace, 'node_modules/@esportsplus/template');

    rmSync(workspace, { force: true, recursive: true });
    mkdirSync(target, { recursive: true });
    cpSync(join(pkg, 'build'), join(target, 'build'), { recursive: true });
    cpSync(join(pkg, 'package.json'), join(target, 'package.json'));
    cpSync(join(HERE, 'app.ts'), app);
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({ name: 'compiled-bench', private: true, type: 'module' }));
    writeFileSync(config, JSON.stringify({
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
        files: ['app.ts']
    }));

    let template = (await import(pathToFileURL(join(target, 'build/compiler/index.js')).href)).default,
        opened = languageService.open(config),
        sourceFile = opened.project.program.getSourceFile(app);

    if (!sourceFile) {
        throw new Error(`Compiled: '${app}' is not in the program!`);
    }

    try {
        let result = coordinator.transform(
                [reactivity, template],
                sourceFile.getFullText(),
                sourceFile,
                { checker: opened.project.checker, configPath: config, program: opened.project.program },
                workspace,
                new Map()
            );

        if (!result.changed || result.code.includes('html`')) {
            throw new Error('Compiled: the app did not compile!');
        }

        writeFileSync(app, result.code);
    }
    finally {
        languageService.dispose();
    }

    return app;
}


let chrome = process.env.CHROME || CHROME_PATHS.find(existsSync);

if (!chrome) {
    throw new Error('Compiled: no Chrome/Edge binary found, set CHROME env var!');
}

let label = process.env.BENCH_LABEL || 'compiled',
    pkg = resolve(process.env.BENCH_TEMPLATE || ROOT),
    workspace = join(ROOT, 'node_modules/.cache/template-bench', label.replace(/[^\w-]/g, '_')),
    app = await compile(pkg, workspace);

// Production bundle of the app alone: what a consumer ships, minified, with the development condition off
let production = await esbuild().build({
        bundle: true,
        conditions: ['production'],
        define: { 'process.env.NODE_ENV': '"production"' },
        entryPoints: [app],
        format: 'esm',
        minify: true,
        platform: 'browser',
        target: 'es2024',
        write: false
    }),
    size = {
        gzip: gzipSync(production.outputFiles[0].contents).length,
        raw: production.outputFiles[0].contents.length
    };

let bundle = await esbuild().build({
        bundle: true,
        entryPoints: [join(HERE, 'browser.ts')],
        format: 'iife',
        platform: 'browser',
        plugins: [{
            name: 'compiled-app',
            setup(build) {
                build.onResolve({ filter: /^\.\/app$/ }, (args) => args.importer === join(HERE, 'browser.ts') ? { path: app } : undefined);
            }
        }],
        target: 'es2024',
        write: false
    }),
    js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

if (js.includes('html`` templates')) {
    throw new Error('Compiled: the uncompiled html runtime reached the bundle!');
}

mkdirSync(STORAGE, { recursive: true });

let page = join(STORAGE, `compiled-${label.replace(/[^\w-]/g, '_')}.html`);

writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><title>compiled</title></head><body><script>${js}</script></body></html>`);

let dom = execFileSync(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--js-flags=--expose-gc',
        `--user-data-dir=${join(STORAGE, 'chrome-profile')}`,
        '--dump-dom',
        pathToFileURL(page).href
    ], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 600000
    }),
    match = dom.match(/<pre id="results">([\s\S]*?)<\/pre>/);

if (!match) {
    throw new Error(`Compiled: no results found in dumped DOM (${dom.length} bytes)!`);
}

let { results } = JSON.parse(match[1].replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<'));

console.log(`\n[${label}] ${pkg} (${readFileSync(join(pkg, 'package.json'), 'utf8').match(/"version": "([^"]+)"/)[1]})\n`);
console.log(table(results) + '\n');
console.log(`production bundle: ${size.raw} bytes, ${size.gzip} gzip\n`);

let out = process.env.BENCH_OUT;

if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ label, results, size }, null, 4));
    console.log(`Results written to ${out}`);
}
