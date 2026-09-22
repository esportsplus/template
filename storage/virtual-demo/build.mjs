import { createRequire } from 'node:module';
import { realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(HERE, '../..');


function esbuild() {
    let root = createRequire(join(ROOT, 'package.json')),
        vitest = createRequire(realpathSync(root.resolve('vitest'))),
        vite = createRequire(realpathSync(vitest.resolve('vite')));

    return vite('esbuild');
}


let bundle = esbuild().buildSync({
        bundle: true,
        entryPoints: [join(HERE, 'app.ts')],
        format: 'iife',
        platform: 'browser',
        target: 'es2024',
        write: false
    }),
    js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

writeFileSync(join(HERE, 'index.html'), `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>virtual demo</title>
<style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 14px/1.5 system-ui, sans-serif; display: flex; flex-direction: column; height: 100vh; }
    #bar { display: flex; gap: 8px; padding: 10px; border-bottom: 1px solid #ddd; align-items: center; flex-wrap: wrap; }
    #status { margin-left: auto; color: #555; font-variant-numeric: tabular-nums; }
    #scroller { flex: 1; overflow-y: auto; min-height: 0; }
    .row { padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,.08); }
    .row .id { font-weight: 600; margin-right: 8px; color: #333; }
    .card .head { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .card .meta { color: #777; font-size: 12px; }
    .card .body { margin: 0 0 8px; }
    .card button { font: inherit; font-size: 12px; padding: 4px 10px; }
    .note { padding: 8px 16px; font-size: 13px; }
    .quote { margin: 0; padding: 20px 32px; font-style: italic; border-left: 6px solid rgba(0,0,0,.2); }
    .quote .body { margin: 0; }
</style>
</head>
<body>
<div id="bar">
    <a id="mode" href="?chat"></a>
    <button id="top">top</button>
    <button id="one">push 1</button>
    <button id="jump">scrollTo random</button>
    <button id="end">end</button>
    <button id="push">push 1000</button>
    <button id="unshift">unshift 100</button>
    <button id="splice">splice above viewport</button>
    <button id="sort">sort by length</button>
    <button id="reverse">reverse</button>
    <span id="status"></span>
</div>
<div id="debug" style="padding: 4px 10px; font: 12px monospace; color: #666; border-bottom: 1px solid #eee;"></div>
<div id="scroller"></div>
<pre id="trace" style="margin: 0; padding: 6px 10px; font-size: 10px; line-height: 1.3; max-height: 260px; overflow: auto; border-top: 1px solid #ddd; color: #444;"></pre>
<script>${js}<\/script>
</body>
</html>
`);

console.log(join(HERE, 'index.html'));
