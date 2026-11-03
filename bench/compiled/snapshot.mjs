// Freezes the current `build/` as a named package dir for pair.mjs: node bench/compiled/snapshot.mjs <label>
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');


let label = process.argv[2];

if (!label || /[^\w]/.test(label)) {
    throw new Error('Snapshot: a word-character label is required!');
}

if (!existsSync(join(ROOT, 'build/index.js'))) {
    throw new Error('Snapshot: build/ is missing, run pnpm build first!');
}

let target = join(ROOT, 'node_modules/.cache/template-bench/pkg', label);

rmSync(target, { force: true, recursive: true });
mkdirSync(target, { recursive: true });
cpSync(join(ROOT, 'build'), join(target, 'build'), { recursive: true });
cpSync(join(ROOT, 'package.json'), join(target, 'package.json'));

console.log(target);
