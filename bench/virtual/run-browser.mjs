import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


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

const TIMEOUT = 600000;


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

    let lines = [`${'benchmark'.padEnd(pad)}  ${'step median'.padStart(11)}  ${'step max'.padStart(8)}  ${'script'.padStart(8)}  ${'forced'.padStart(8)}  ${'blocking'.padStart(8)}  ${'slow'.padStart(6)}  ${'nodes'.padStart(8)}`];

    for (let i = 0, n = results.length; i < n; i++) {
        let r = results[i];

        lines.push(`${r.name.padEnd(pad)}  ${r.median.toFixed(3).padStart(9)}ms  ${r.max.toFixed(3).padStart(6)}ms  ${r.script.toFixed(1).padStart(6)}ms  ${r.forced.toFixed(1).padStart(6)}ms  ${r.blocking.toFixed(1).padStart(6)}ms  ${String(r.slow).padStart(6)}  ${String(r.nodes).padStart(8)}`);
    }

    return lines.join('\n');
}

function serve(js, label, binary) {
    return new Promise((resolve, reject) => {
        let child = null,
            settled = false,
            timer = null,
            server = createServer((request, response) => {
                if (request.method === 'POST' && request.url === '/results') {
                    let body = '';

                    request.on('data', (chunk) => {
                        body += chunk;
                    });

                    request.on('end', () => {
                        response.end('ok');

                        try {
                            finish(null, JSON.parse(body));
                        }
                        catch (error) {
                            finish(error);
                        }
                    });

                    return;
                }

                response.setHeader('content-type', 'text/html; charset=utf-8');
                response.end(`<!doctype html><html><head><meta charset="utf-8"><title>virtual</title></head><body><script>${js}<\/script></body></html>`);
            });

        function finish(error, results) {
            if (settled) {
                return;
            }

            settled = true;

            clearTimeout(timer);
            server.closeAllConnections?.();
            server.close();
            child?.kill();

            if (error) {
                reject(error);
            }
            else {
                resolve(results);
            }
        }

        timer = setTimeout(() => finish(new Error(`Virtual: bench timed out after ${TIMEOUT}ms!`)), TIMEOUT);

        server.listen(0, '127.0.0.1', () => {
            let port = server.address().port,
                profile = join(STORAGE, `chrome-profile-${label.replace(/[^\w-]/g, '_')}`);

            mkdirSync(STORAGE, { recursive: true });

            child = execFile(binary, [
                '--headless=new',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-gpu',
                '--disable-renderer-backgrounding',
                '--no-first-run',
                `--user-data-dir=${profile}`,
                `http://127.0.0.1:${port}/`
            ], { stdio: 'ignore' });

            child.on('error', (error) => finish(error));
            child.on('exit', (code) => finish(new Error(`Virtual: chrome exited with code ${code} before reporting results!`)));
        });
    });
}


let binary = process.env.CHROME || CHROME_PATHS.find(existsSync);

if (!binary) {
    throw new Error('Virtual: no Chrome/Edge binary found, set CHROME env var!');
}

let bundle = esbuild().buildSync({
        bundle: true,
        entryPoints: [join(HERE, 'browser.ts')],
        format: 'iife',
        platform: 'browser',
        target: 'es2024',
        write: false
    }),
    js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'),
    label = process.env.BENCH_LABEL || 'virtual';

mkdirSync(STORAGE, { recursive: true });

let { baseline, virtual } = await serve(js, label, binary);

console.log(`\n[${label}] chrome ${binary}\n`);
console.log(`[virtual]\n${table(virtual)}\n`);
console.log(`[baseline]\n${table(baseline)}\n`);

let out = process.env.BENCH_OUT;

if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ baseline, label, virtual }, null, 4));
    console.log(`Results written to ${out}`);
}
