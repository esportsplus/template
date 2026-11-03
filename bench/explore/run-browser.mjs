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


// A worktree may have no node_modules of its own; the main checkout (the parent of git's common dir) does
function dependencies() {
    if (existsSync(join(ROOT, 'node_modules'))) {
        return ROOT;
    }

    let common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' }).trim();

    return dirname(common);
}

function esbuild(from) {
    let root = createRequire(join(from, 'package.json')),
        vitest = createRequire(realpathSync(root.resolve('vitest'))),
        vite = createRequire(realpathSync(vitest.resolve('vite')));

    return vite('esbuild');
}

function table(results) {
    let lines = [],
        pad = 0;

    for (let i = 0, n = results.length; i < n; i++) {
        if (results[i].variant.length > pad) {
            pad = results[i].variant.length;
        }
    }

    for (let i = 0, n = results.length; i < n; i++) {
        let r = results[i];

        if (i === 0 || results[i - 1].name !== r.name) {
            lines.push('', `${r.item}  ${r.name}`);
        }

        lines.push(`    ${r.variant.padEnd(pad)}  ${r.ns.toFixed(1).padStart(9)} ns/op  ${r.delta === null ? '' : (r.delta > 0 ? '+' : '') + r.delta.toFixed(1) + '%'}`);
    }

    return lines.join('\n');
}


let chrome = process.env.CHROME || CHROME_PATHS.find(existsSync);

if (!chrome) {
    throw new Error('Explore: no Chrome/Edge binary found, set CHROME env var!');
}

let modules = dependencies(),
    bundle = esbuild(modules).buildSync({
        absWorkingDir: ROOT,
        bundle: true,
        entryPoints: [join(HERE, 'browser.ts')],
        format: 'iife',
        nodePaths: [join(modules, 'node_modules')],
        platform: 'browser',
        target: 'es2024',
        write: false
    }),
    js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

mkdirSync(STORAGE, { recursive: true });

let page = join(STORAGE, 'explore.html');

writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><title>explore</title></head><body><script>${js}</script></body></html>`);

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
    throw new Error(`Explore: no results found in dumped DOM (${dom.length} bytes)!`);
}

let { results } = JSON.parse(match[1].replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<'));

console.log(`\nchrome ${chrome}\n`);
console.log(table(results) + '\n');

let out = process.env.BENCH_OUT;

if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ results }, null, 4));
    console.log(`Results written to ${out}`);
}
