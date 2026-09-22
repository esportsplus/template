import type { App } from './app';


type LongFrame = {
    blocking: number;
    duration: number;
    forced: number;
};

type Op = {
    name: string;
    samples: number;
    setup: () => void;
    step: (index: number) => void;
    steps: number;
};

type Result = {
    blocking: number;
    forced: number;
    max: number;
    median: number;
    name: string;
    nodes: number;
    samples: number;
    script: number;
    slow: number;
};


const LONG_FRAME = 'long-animation-frame';

const SLOW_FRAME = 25;

const WARMUP = 1;


let warned = false;


const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

function accumulate(total: LongFrame, entries: PerformanceEntryList) {
    for (let i = 0, n = entries.length; i < n; i++) {
        let entry = entries[i] as PerformanceEntry & {
                blockingDuration?: number;
                scripts?: { forcedStyleAndLayoutDuration?: number }[];
            },
            scripts = entry.scripts || [];

        total.duration += entry.duration;
        total.blocking += entry.blockingDuration || 0;

        for (let j = 0, m = scripts.length; j < m; j++) {
            total.forced += scripts[j].forcedStyleAndLayoutDuration || 0;
        }
    }
}

function longFrames() {
    let total: LongFrame = {
            blocking: 0,
            duration: 0,
            forced: 0
        },
        supported = typeof PerformanceObserver !== 'undefined'
            && PerformanceObserver.supportedEntryTypes?.includes(LONG_FRAME),
        observer = supported ? new PerformanceObserver((list) => accumulate(total, list.getEntries())) : null;

    if (observer) {
        observer.observe({ type: LONG_FRAME });
    }
    else if (!warned) {
        warned = true;
        console.warn('Virtual: long-animation-frame is unsupported, reporting 0 for script/forced/blocking');
    }

    return () => {
        if (observer) {
            accumulate(total, observer.takeRecords());
            observer.disconnect();
        }

        return total;
    };
}

async function settle() {
    await frame();
    await frame();
}

async function mount(app: App) {
    for (let i = 0; i < 120; i++) {
        if (app.scroller.children.length > 2) {
            await settle();
            return;
        }

        await frame();
    }
}

function countNodes(element: HTMLElement) {
    let count = 0,
        walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);

    while (walker.nextNode()) {
        count++;
    }

    return count;
}

function median(values: number[]) {
    if (!values.length) {
        return 0;
    }

    let sorted = values.slice().sort((a, b) => a - b);

    return sorted[sorted.length >> 1];
}

async function measure(app: App, op: Op): Promise<Result> {
    let stop = longFrames(),
        frames: number[] = [],
        steps: number[] = [],
        count = op.steps;

    for (let i = 0; i < WARMUP; i++) {
        app.reset();
        op.setup();
        await settle();

        for (let s = 0; s < count; s++) {
            op.step(s);
            await frame();
        }
    }

    for (let i = 0, n = op.samples; i < n; i++) {
        app.reset();
        op.setup();
        await settle();

        let last = await frame();

        for (let s = 0; s < count; s++) {
            let start = performance.now();

            op.step(s);

            steps.push(performance.now() - start);

            let current = await frame();

            frames.push(current - last);
            last = current;
        }
    }

    let long = stop(),
        max = 0,
        slow = 0;

    for (let i = 0, n = steps.length; i < n; i++) {
        if (steps[i] > max) {
            max = steps[i];
        }
    }

    for (let i = 0, n = frames.length; i < n; i++) {
        if (frames[i] > SLOW_FRAME) {
            slow++;
        }
    }

    return {
        blocking: long.blocking,
        forced: long.forced,
        max,
        median: median(steps),
        name: op.name,
        nodes: countNodes(app.scroller),
        samples: steps.length,
        script: long.duration,
        slow
    };
}

const run = async (app: App): Promise<Result[]> => {
    await mount(app);

    let results: Result[] = [],
        ops: Op[] = [
            {
                name: 'wheel-step scroll (100 x 120px)',
                samples: 3,
                setup: () => {},
                step: () => app.wheel(120),
                steps: 100
            },
            {
                name: 'page scroll (20 x 800px)',
                samples: 3,
                setup: () => {},
                step: () => app.wheel(800),
                steps: 20
            },
            {
                name: 'scrollbar drag to middle',
                samples: 20,
                setup: () => {},
                step: () => app.dragToMiddle(),
                steps: 1
            },
            {
                name: 'backward scroll from end (100 x 120px)',
                samples: 2,
                setup: () => app.scrollToEnd(),
                step: () => app.wheel(-120),
                steps: 100
            },
            {
                name: 'expand row above viewport',
                samples: 20,
                setup: () => app.scrollToFraction(0.5),
                step: () => app.expandAboveViewport(),
                steps: 1
            },
            {
                name: 'splice 1,000 rows above viewport',
                samples: 15,
                setup: () => app.scrollToFraction(0.5),
                step: () => app.spliceAboveViewport(),
                steps: 1
            },
            {
                name: 'scrollTo far index (80,000)',
                samples: 20,
                setup: () => {},
                step: () => app.scrollToIndex(80000),
                steps: 1
            }
        ];

    for (let i = 0, n = ops.length; i < n; i++) {
        results.push(await measure(app, ops[i]));
    }

    return results;
};

const format = (results: Result[]): string => {
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
};


export { format, run };
export type { Op, Result };
