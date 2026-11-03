import { measure } from '../krausest/harness';
import type { Op, Result } from '../krausest/harness';
import type { App } from './app';


const run = (app: App, flush: VoidFunction, forceLayout?: VoidFunction): Result[] => {
    let toggle = false;

    function cards(n: number) {
        rows(0);

        if (app.cards.length !== n) {
            app.clearCards();
            flush();

            if (n > 0) {
                app.appendCards(n);
                flush();
            }
        }
    }

    // Cards kept across samples, so every sample after the warmup changes cards that already changed
    function keep(n: number) {
        if (app.rows.length !== 0) {
            app.clearRows();
            flush();
        }

        if (app.cards.length !== n) {
            app.clearCards();
            flush();
            app.appendCards(n);
            flush();
        }
    }

    function rows(n: number) {
        if (app.cards.length !== 0) {
            app.clearCards();
            flush();
        }

        if (app.rows.length !== n) {
            app.clearRows();
            flush();

            if (n > 0) {
                app.appendRows(n);
                flush();
            }
        }
    }

    let ops: Op[] = [
            {
                fn: () => app.appendRows(1000),
                name: 'rows: create 1,000',
                samples: 20,
                setup: () => rows(0)
            },
            {
                fn: () => app.partialUpdate(),
                name: 'rows: update every 10th label',
                samples: 40,
                setup: () => rows(1000)
            },
            {
                fn: () => {
                    toggle = !toggle;

                    return app.select(toggle ? 1 : 5);
                },
                name: 'rows: select',
                samples: 60,
                setup: () => rows(1000)
            },
            {
                fn: () => app.toggleCompact(),
                name: 'rows: toggle text effects (1,000)',
                samples: 40,
                setup: () => rows(1000)
            },
            {
                fn: () => app.toggleDense(),
                name: 'rows: toggle class (1,000)',
                samples: 40,
                setup: () => rows(1000)
            },
            {
                fn: () => app.toggleBold(),
                name: 'rows: toggle style (1,000)',
                samples: 40,
                setup: () => rows(1000)
            },
            {
                fn: () => app.toggleLocked(),
                name: 'rows: toggle disabled (1,000)',
                samples: 40,
                setup: () => rows(1000)
            },
            {
                fn: () => app.swap(),
                name: 'rows: swap',
                samples: 60,
                setup: () => rows(1000)
            },
            {
                fn: () => app.removeRow(),
                name: 'rows: remove one',
                samples: 30,
                setup: () => {
                    if (app.rows.length < 900) {
                        rows(0);
                    }

                    rows(app.rows.length || 1000);
                }
            },
            {
                fn: () => app.clearRows(),
                name: 'rows: clear 1,000',
                samples: 25,
                setup: () => rows(1000)
            },
            {
                fn: () => app.appendRows(10000),
                name: 'rows: create 10,000',
                samples: 6,
                setup: () => rows(0)
            },
            {
                fn: () => app.appendCards(1000),
                name: 'cards: create 1,000',
                samples: 20,
                setup: () => cards(0)
            },
            {
                fn: () => app.likeEvery10th(),
                name: 'cards: like every 10th (first change)',
                samples: 40,
                setup: () => cards(1000)
            },
            {
                fn: () => app.likeEvery10th(),
                name: 'cards: like every 10th (repeat)',
                samples: 40,
                setup: () => keep(1000)
            },
            {
                fn: () => app.clearCards(),
                name: 'cards: clear 1,000',
                samples: 25,
                setup: () => cards(1000)
            }
        ],
        results: Result[] = [];

    for (let i = 0, n = ops.length; i < n; i++) {
        results.push(measure(ops[i], flush, forceLayout));
    }

    return results;
};


export { run };
