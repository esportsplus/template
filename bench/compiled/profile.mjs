// CPU profile of one scenario of the compiled bench app in headless Chrome, through the DevTools protocol.
//
// usage: node bench/compiled/profile.mjs <label> <scenario> [--top N] [--focus FUNCTION]
//
// <label> is a workspace run-browser.mjs already compiled (BENCH_LABEL). --focus prints the self time
// of the leaves under one function only.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';


const CHROME_PATHS = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(HERE, '../..');

const SCENARIOS = {
    'cards-create': `for (let i = 0; i < 40; i++) { app.clearCards(); flush(); app.appendCards(1000); flush(); layout(); }`,
    'cards-first': `for (let i = 0; i < 60; i++) { app.clearCards(); flush(); app.appendCards(1000); flush(); layout(); timed(); layout(); }`,
    'cards-first-gc': `for (let i = 0; i < 60; i++) { app.clearCards(); flush(); app.appendCards(1000); flush(); layout(); (globalThis as any).gc(); timed(); layout(); }`,
    'cards-like': `app.appendCards(1000); flush(); layout(); for (let i = 0; i < 3000; i++) { app.likeEvery10th(); flush(); }`,
    'rows-clear': `for (let i = 0; i < 40; i++) { app.appendRows(1000); flush(); layout(); app.clearRows(); flush(); layout(); }`,
    'rows-create': `for (let i = 0; i < 40; i++) { app.clearRows(); flush(); app.appendRows(1000); flush(); layout(); }`,
    'rows-update': `app.appendRows(1000); flush(); for (let i = 0; i < 400; i++) { app.toggleDense(); flush(); app.toggleCompact(); flush(); app.partialUpdate(); flush(); app.toggleBold(); flush(); layout(); }`
};


function name(node) {
    let frame = node.callFrame;

    return `${frame.functionName || '(anonymous)'}${frame.url ? ':' + (frame.lineNumber + 1) : ''}`;
}


let { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            focus: { type: 'string' },
            top: { default: '45', type: 'string' }
        }
    }),
    [label, scenario] = positionals,
    chrome = process.env.CHROME || CHROME_PATHS.find(existsSync),
    scratch = join(ROOT, 'node_modules/.cache/template-bench/profile'),
    workspace = join(ROOT, 'node_modules/.cache/template-bench', label ?? '');

if (!label || !SCENARIOS[scenario]) {
    throw new Error(`Profile: usage <label> <${Object.keys(SCENARIOS).join('|')}>!`);
}

if (!chrome) {
    throw new Error('Profile: no Chrome/Edge binary found, set CHROME env var!');
}

if (!existsSync(join(workspace, 'app.ts'))) {
    throw new Error(`Profile: no compiled app for '${label}', run run-browser.mjs with BENCH_LABEL=${label} first!`);
}

mkdirSync(scratch, { recursive: true });

let entry = join(scratch, `${label}-${scenario}.ts`),
    posix = (path) => path.replace(/\\/g, '/');

writeFileSync(entry, `
import { flush } from '${posix(join(ROOT, 'bench/krausest/setup'))}';
import { create } from '${posix(workspace)}/app';

let container = document.createElement('div');
document.body.appendChild(container);
let app = create(container), layout = () => { void container.offsetHeight; };
let times: number[] = [];
function timed() { let t = performance.now(); app.likeEvery10th(); flush(); times.push(performance.now() - t); }
(globalThis as any).report = () => { let s = [...times].sort((a, b) => a - b); return s[s.length >> 1]; };
setTimeout(() => {
    ${SCENARIOS[scenario]}
    document.title = 'done';
}, 200);
`);

let root = createRequire(join(ROOT, 'package.json')),
    vitest = createRequire(realpathSync(root.resolve('vitest'))),
    esbuild = createRequire(realpathSync(vitest.resolve('vite')))('esbuild'),
    bundle = await esbuild.build({ bundle: true, entryPoints: [entry], format: 'iife', platform: 'browser', target: 'es2024', write: false }),
    page = join(scratch, `${label}-${scenario}.html`);

writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><title>run</title></head><body><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);

let browser = spawn(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--remote-debugging-port=0',
        '--js-flags=--expose-gc',
        `--user-data-dir=${join(scratch, 'chrome-profile')}`,
        'about:blank'
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

let endpoint = await new Promise((resolve, reject) => {
        let buffer = '';

        browser.stderr.on('data', (chunk) => {
            buffer += chunk;

            let match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);

            if (match) {
                resolve(match[1]);
            }
        });
        setTimeout(() => reject(new Error('Profile: no DevTools endpoint!')), 20000);
    }),
    id = 0,
    pending = new Map(),
    socket = new WebSocket(endpoint);

await new Promise((resolve) => socket.addEventListener('open', resolve));

socket.addEventListener('message', (event) => {
    let message = JSON.parse(event.data);

    if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
    }
});

let send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    let message = { id: ++id, method, params };

    if (sessionId) {
        message.sessionId = sessionId;
    }

    pending.set(message.id, (reply) => reply.error ? reject(new Error(JSON.stringify(reply.error))) : resolve(reply.result));
    socket.send(JSON.stringify(message));
});

let { targetId } = await send('Target.createTarget', { url: 'about:blank' }),
    { sessionId } = await send('Target.attachToTarget', { flatten: true, targetId });

await send('Profiler.enable', {}, sessionId);
await send('Profiler.setSamplingInterval', { interval: 50 }, sessionId);
await send('Page.enable', {}, sessionId);
await send('Profiler.start', {}, sessionId);
await send('Page.navigate', { url: pathToFileURL(page).href }, sessionId);

for (let i = 0; i < 1200; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));

    let { result } = await send('Runtime.evaluate', { expression: 'document.title' }, sessionId);

    if (result.value === 'done') {
        break;
    }
}

let { profile } = await send('Profiler.stop', {}, sessionId),
    { result: timed } = await send('Runtime.evaluate', { expression: 'report()' }, sessionId);

if (typeof timed.value === 'number') {
    console.log(`median timed like: ${timed.value}ms`);
}

socket.close();
browser.kill();

let byId = new Map(),
    hits = new Map(),
    inclusive = new Map(),
    self = new Map(),
    total = 0;

for (let node of profile.nodes) {
    byId.set(node.id, node);
}

for (let node of profile.nodes) {
    for (let child of node.children || []) {
        byId.get(child).parent = node.id;
    }
}

for (let i = 0, n = profile.samples.length; i < n; i++) {
    hits.set(profile.samples[i], (hits.get(profile.samples[i]) || 0) + (profile.timeDeltas[i + 1] ?? 0));
}

if (values.focus) {
    let sum = 0,
        within = new Map();

    for (let [nodeId, dt] of hits) {
        let leaf = byId.get(nodeId);

        for (let n = leaf; n; n = n.parent !== undefined ? byId.get(n.parent) : null) {
            if (n.callFrame.functionName === values.focus) {
                sum += dt;
                within.set(name(leaf), (within.get(name(leaf)) || 0) + dt);
                break;
            }
        }
    }

    console.log(`\n${label} ${scenario}: ${(sum / 1000).toFixed(1)}ms inside ${values.focus}\n`);

    for (let [key, us] of [...within].sort((a, b) => b[1] - a[1]).slice(0, Number(values.top))) {
        console.log(((us / 1000).toFixed(1) + 'ms').padStart(9) + ((us / sum) * 100).toFixed(1).padStart(6) + '%  ' + key);
    }

    process.exit(0);
}

for (let [nodeId, dt] of hits) {
    let node = byId.get(nodeId),
        seen = new Set();

    if (node.callFrame.functionName === '(idle)' || node.callFrame.functionName === '(program)') {
        continue;
    }

    total += dt;
    self.set(name(node), (self.get(name(node)) || 0) + dt);

    for (let n = node; n; n = n.parent !== undefined ? byId.get(n.parent) : null) {
        let key = name(n);

        if (!seen.has(key)) {
            seen.add(key);
            inclusive.set(key, (inclusive.get(key) || 0) + dt);
        }
    }
}

let fmt = (us) => (us / 1000).toFixed(1).padStart(8) + 'ms' + ((us / total) * 100).toFixed(1).padStart(6) + '%';

console.log(`\n${label} ${scenario}: ${(total / 1000).toFixed(0)}ms busy\n\nSELF`);

for (let [key, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(values.top))) {
    console.log(fmt(us) + '  ' + key);
}

console.log('\nINCLUSIVE');

for (let [key, us] of [...inclusive].sort((a, b) => b[1] - a[1]).slice(0, Number(values.top))) {
    console.log(fmt(us) + '  ' + key);
}

process.exit(0);
