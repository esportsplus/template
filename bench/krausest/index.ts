import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { it } from 'vitest';
import { format, run } from './harness';
import { flush } from './setup';


// Dynamic import guarantees the scheduler stubs in './setup' are installed before the library evaluates
const { create } = await import('./app');


it('krausest suite', () => {
    let container = document.createElement('div');

    document.body.appendChild(container);

    let results = run(create(container), flush);

    console.log('\n' + format(results) + '\n');

    let out = process.env.BENCH_OUT;

    if (out) {
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, JSON.stringify({ label: process.env.BENCH_LABEL || 'unlabeled', results }, null, 4));
        console.log(`Results written to ${out}`);
    }
}, 600000);
