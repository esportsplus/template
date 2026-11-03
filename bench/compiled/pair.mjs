// Paired rounds of the compiled bench: each round runs every build once, in an order rotated per round, and
// every build is compared against the base (first) build of the same round.
//
// usage: node bench/compiled/pair.mjs [--rounds N] [--session NAME] [--metric median|script|mean|min] [--summary] <label=package dir>...
//
// A package dir holds `package.json` and a built `build/` (see snapshot.mjs). Rounds already on disk are
// skipped, so an interrupted session resumes where it stopped.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';


const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(HERE, '../..');


function median(values) {
    let sorted = [...values].sort((a, b) => a - b);

    return sorted.length % 2 ? sorted[sorted.length >> 1] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}

function signed(value) {
    return (value >= 0 ? '+' : '') + value.toFixed(1);
}


let { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            metric: { default: 'median', type: 'string' },
            rounds: { default: '10', type: 'string' },
            session: { default: 's1', type: 'string' },
            summary: { default: false, type: 'boolean' }
        }
    }),
    builds = {};

for (let i = 0, n = positionals.length; i < n; i++) {
    let [label, dir] = positionals[i].split('=');

    if (!label || !dir || /[^\w]/.test(label)) {
        throw new Error(`Pair: '${positionals[i]}' is not label=dir with a word-character label!`);
    }

    builds[label] = resolve(dir);
}

let labels = Object.keys(builds),
    out = join(ROOT, 'node_modules/.cache/template-bench/results', values.session),
    rounds = Number(values.rounds);

if (labels.length < 1) {
    throw new Error('Pair: no builds given!');
}

mkdirSync(out, { recursive: true });

if (!values.summary) {
    for (let round = 1; round <= rounds; round++) {
        for (let i = 0, n = labels.length; i < n; i++) {
            let label = labels[(i + round) % n],
                file = join(out, `${label}-${round}.json`);

            if (existsSync(file)) {
                continue;
            }

            execFileSync('node', [join(HERE, 'run-browser.mjs')], {
                cwd: ROOT,
                env: { ...process.env, BENCH_LABEL: label, BENCH_OUT: file, BENCH_TEMPLATE: builds[label] },
                stdio: ['ignore', 'ignore', 'inherit'],
                timeout: 900000
            });
            console.log(`round ${round} ${label} done`);
        }
    }
}

let runs = {};

for (let file of readdirSync(out)) {
    let [label, round] = file.replace('.json', '').split('-');

    (runs[label] ??= {})[round] = JSON.parse(readFileSync(join(out, file), 'utf8')).results;
}

let base = labels[0],
    metric = values.metric,
    done = Object.keys(runs[base] ?? {}),
    names = runs[base][done[0]].map((r) => r.name),
    pad = Math.max(...names.map((n) => n.length));

console.log(`\nsession ${values.session}, ${done.length} rounds, ${metric}, paired deltas vs ${base}: median [p25, p75]\n`);
console.log('benchmark'.padEnd(pad) + `${base} ms`.padStart(12) + labels.slice(1).map((l) => l.padStart(22)).join(''));

for (let i = 0, n = names.length; i < n; i++) {
    let line = names[i].padEnd(pad) + median(done.map((r) => runs[base][r][i][metric])).toFixed(2).padStart(12);

    for (let label of labels.slice(1)) {
        let deltas = done
                .filter((r) => runs[label]?.[r])
                .map((r) => (runs[label][r][i][metric] / runs[base][r][i][metric] - 1) * 100)
                .sort((a, b) => a - b);

        if (!deltas.length) {
            line += '-'.padStart(22);
            continue;
        }

        let q = (p) => deltas[Math.min(deltas.length - 1, Math.floor(p * (deltas.length - 1) + 0.5))];

        line += `${signed(median(deltas))}% [${signed(q(0.25))}, ${signed(q(0.75))}]`.padStart(22);
    }

    console.log(line);
}
