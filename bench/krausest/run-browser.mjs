import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';


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

    let lines = [`${'benchmark'.padEnd(pad)}  ${'median'.padStart(10)}  ${'mean'.padStart(10)}  ${'min'.padStart(10)}  ${'max'.padStart(10)}`];

    for (let i = 0, n = results.length; i < n; i++) {
        let r = results[i];

        lines.push(`${r.name.padEnd(pad)}  ${r.median.toFixed(2).padStart(8)}ms  ${r.mean.toFixed(2).padStart(8)}ms  ${r.min.toFixed(2).padStart(8)}ms  ${r.max.toFixed(2).padStart(8)}ms`);
    }

    return lines.join('\n');
}


let chrome = process.env.CHROME || CHROME_PATHS.find(existsSync);

if (!chrome) {
    throw new Error('Krausest: no Chrome/Edge binary found, set CHROME env var!');
}

let bundle = esbuild().buildSync({
        bundle: true,
        entryPoints: [join(HERE, 'browser.ts')],
        format: 'iife',
        platform: 'browser',
        target: 'es2024',
        write: false
    }),
    label = process.env.BENCH_LABEL || 'browser',
    js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

mkdirSync(STORAGE, { recursive: true });

let page = join(STORAGE, `page-${label.replace(/[^\w-]/g, '_')}.html`);

writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><title>krausest</title></head><body><script>${js}</script></body></html>`);

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
    throw new Error(`Krausest: no results found in dumped DOM (${dom.length} bytes)!`);
}

let { results } = JSON.parse(match[1].replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<'));

console.log(`\n[${label}] chrome ${chrome}\n`);
console.log(table(results) + '\n');

let out = process.env.BENCH_OUT;

if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ label, results }, null, 4));
    console.log(`Results written to ${out}`);
}
