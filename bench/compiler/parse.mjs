// Parser micro-bench: parse() over every template of the corpus, per package, interleaved rounds.
// usage: node bench/compiler/parse.mjs <label=package dir>...
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';


const HERE = dirname(fileURLToPath(import.meta.url));

const REGEX_TEMPLATE = /html`((?:[^`\\]|\\.)*)`/g;


function median(values) {
    let sorted = [...values].sort((a, b) => a - b);

    return sorted[sorted.length >> 1];
}

// The literals of each html`` in the corpus, split at its top-level ${...}; nested templates count on their own
function templates() {
    let all = [];

    for (let file of readdirSync(join(HERE, 'corpus')).filter((f) => f.endsWith('.ts'))) {
        let source = readFileSync(join(HERE, 'corpus', file), 'utf8');

        for (let match of source.matchAll(REGEX_TEMPLATE)) {
            let body = match[1],
                depth = 0,
                literals = [''],
                i = 0;

            while (i < body.length) {
                if (depth === 0 && body.startsWith('${', i)) {
                    depth = 1;
                    i += 2;
                    literals.push('');
                    continue;
                }

                if (depth > 0) {
                    if (body[i] === '{') {
                        depth++;
                    }
                    else if (body[i] === '}') {
                        depth--;
                    }

                    i++;
                    continue;
                }

                literals[literals.length - 1] += body[i++];
            }

            all.push(literals);
        }
    }

    return all;
}


let builds = process.argv.slice(2).map((arg) => {
        let [label, dir] = arg.split('=');

        return { dir: resolve(dir), label };
    }),
    inputs = templates(),
    parsers = [];

for (let build of builds) {
    parsers.push((await import(pathToFileURL(join(build.dir, 'build/compiler/parser.js')).href)).default);
}

let samples = builds.map(() => []);

for (let round = 0; round < 15; round++) {
    for (let b = 0, n = builds.length; b < n; b++) {
        let parser = parsers[b],
            start = performance.now();

        for (let k = 0; k < 200; k++) {
            for (let i = 0, m = inputs.length; i < m; i++) {
                parser.parse(inputs[i]);
            }
        }

        samples[b].push((performance.now() - start) * 1000 / (200 * inputs.length));
    }
}

console.log(`\n${inputs.length} templates, µs per parse (median of 15 interleaved rounds)\n`);

for (let b = 0, n = builds.length; b < n; b++) {
    let us = median(samples[b]),
        base = median(samples[0]);

    console.log(`${builds[b].label.padEnd(12)} ${us.toFixed(2).padStart(8)} µs  ${b === 0 ? '' : ((us / base - 1) * 100).toFixed(1) + '%'}`);
}
