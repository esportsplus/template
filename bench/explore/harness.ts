type Case<T = any> = {
    item: string;
    iterations: number;
    name: string;
    setup: () => T;
    variants: Variant<T>[];
};

type Result = {
    // Percent against the first variant; null for the first variant itself
    delta: number | null;
    item: string;
    name: string;
    ns: number;
    variant: string;
};

type Variant<T> = {
    fn: (ctx: T) => void;
    name: string;
};


const NOISE = ' (again)';

const ROUNDS = 7;


function median(values: number[]): number {
    let sorted = values.slice().sort((a, b) => a - b);

    return sorted[sorted.length >> 1];
}

function sample<T>(c: Case<T>, variant: Variant<T>): number {
    let ctx = c.setup(),
        fn = variant.fn,
        n = c.iterations;

    for (let i = 0, w = n / 10; i < w; i++) {
        fn(ctx);
    }

    (globalThis as { gc?: VoidFunction }).gc?.();

    let start = performance.now();

    for (let i = 0; i < n; i++) {
        fn(ctx);
    }

    return (performance.now() - start) * 1e6 / n;
}


const format = (results: Result[]): string => {
    let lines: string[] = [],
        pad = 0;

    for (let i = 0, n = results.length; i < n; i++) {
        let width = results[i].variant.length;

        if (width > pad) {
            pad = width;
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
};

// Variants run interleaved per round so drift hits every variant alike; the first variant runs again
// at the end of each round, and its delta against itself is the noise floor for the case
const run = (cases: Case[]): Result[] => {
    let results: Result[] = [];

    for (let i = 0, n = cases.length; i < n; i++) {
        let c = cases[i],
            variants = c.variants.concat({ fn: c.variants[0].fn, name: c.variants[0].name + NOISE }),
            samples: number[][] = variants.map(() => []);

        for (let round = 0; round < ROUNDS; round++) {
            for (let j = 0, m = variants.length; j < m; j++) {
                samples[j].push(sample(c, variants[j]));
            }
        }

        let baseline = median(samples[0]);

        for (let j = 0, m = variants.length; j < m; j++) {
            let ns = median(samples[j]);

            results.push({
                delta: j === 0 ? null : (ns - baseline) / baseline * 100,
                item: c.item,
                name: c.name,
                ns,
                variant: variants[j].name
            });
        }
    }

    return results;
};


export { format, run };
export type { Case, Result, Variant };
