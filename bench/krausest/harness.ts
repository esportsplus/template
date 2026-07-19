import type { App } from './app';


type Op = {
    fn: VoidFunction;
    name: string;
    samples: number;
    setup: VoidFunction;
};

type Result = {
    max: number;
    mean: number;
    median: number;
    min: number;
    name: string;
    samples: number;
};


const WARMUP = 3;


function measure(op: Op, flush: VoidFunction, forceLayout?: VoidFunction): Result {
    let times: number[] = [];

    for (let i = 0; i < WARMUP; i++) {
        op.setup();
        flush();
        forceLayout?.();
        op.fn();
        flush();
        forceLayout?.();
    }

    for (let i = 0, n = op.samples; i < n; i++) {
        op.setup();
        flush();
        forceLayout?.();
        (globalThis as { gc?: VoidFunction }).gc?.();

        let start = performance.now();

        op.fn();
        flush();
        forceLayout?.();
        times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);

    let sum = 0;

    for (let i = 0, n = times.length; i < n; i++) {
        sum += times[i];
    }

    return {
        max: times[times.length - 1],
        mean: sum / times.length,
        median: times[times.length >> 1],
        min: times[0],
        name: op.name,
        samples: times.length
    };
}


const format = (results: Result[]): string => {
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
};

const run = (app: App, flush: VoidFunction, forceLayout?: VoidFunction): Result[] => {
    let toggle = false;

    function ensure(n: number) {
        if (app.rows.length !== n) {
            app.clear();
            flush();

            if (n > 0) {
                app.append(n);
                flush();
            }
        }
    }

    let ops: Op[] = [
            {
                fn: () => app.append(1000),
                name: 'create 1,000 rows',
                samples: 15,
                setup: () => ensure(0)
            },
            {
                fn: () => app.replace(1000),
                name: 'replace all 1,000 rows',
                samples: 15,
                setup: () => ensure(1000)
            },
            {
                fn: () => app.partialUpdate(),
                name: 'partial update every 10th row (1,000)',
                samples: 30,
                setup: () => ensure(1000)
            },
            {
                fn: () => app.select((toggle = !toggle) ? 1 : 5),
                name: 'select row (1,000)',
                samples: 60,
                setup: () => ensure(1000)
            },
            {
                fn: () => app.swap(),
                name: 'swap rows (1,000)',
                samples: 60,
                setup: () => ensure(1000)
            },
            {
                fn: () => app.remove(),
                name: 'remove one row (1,000)',
                samples: 30,
                setup: () => {
                    if (app.rows.length < 900) {
                        ensure(0);
                    }

                    if (app.rows.length === 0) {
                        ensure(1000);
                    }
                }
            },
            {
                fn: () => app.append(10000),
                name: 'create 10,000 rows',
                samples: 5,
                setup: () => ensure(0)
            },
            {
                fn: () => app.append(1000),
                name: 'append 1,000 rows to 10,000',
                samples: 8,
                setup: () => ensure(10000)
            },
            {
                fn: () => app.clear(),
                name: 'clear 10,000 rows',
                samples: 8,
                setup: () => ensure(10000)
            },
            {
                fn: () => app.clear(),
                name: 'clear 1,000 rows',
                samples: 25,
                setup: () => ensure(1000)
            }
        ],
        results: Result[] = [];

    for (let i = 0, n = ops.length; i < n; i++) {
        results.push(measure(ops[i], flush, forceLayout));
    }

    return results;
};


export { format, run };
export type { Op, Result };
