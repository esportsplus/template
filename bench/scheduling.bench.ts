import { bench, describe } from 'vitest';


type Ctx = {
    element: HTMLElement;
    scheduled: boolean;
    textnode: Text;
    updates: Record<string, string | null>;
    updating: boolean;
};


const ATTRS = ['class', 'style', 'title'];

const DENSE = 1000;

const NODES = 1000;

const SPARSE = 10;


function build(n: number): Ctx[] {
    let out: Ctx[] = [];

    for (let i = 0, len = n; i < len; i++) {
        out.push({
            element: document.createElement('div'),
            scheduled: false,
            textnode: document.createTextNode(''),
            updates: {},
            updating: false
        });
    }

    return out;
}

// Identical DOM cost on both sides: 3 attribute writes + 1 text write per dirty node.
function paint(ctx: Ctx, name: string, value: string) {
    ctx.element.setAttribute(name, value);
}


// Current model: attribute queue reallocates updates per drain, EffectSlot allocates a raf closure per slot, ontick iterates a separate Set — three drains
function frameCurrent(nodes: Ctx[], dirty: number) {
    let queue: Ctx[] = [],
        ticks = new Set<VoidFunction>();

    for (let i = 0; i < dirty; i++) {
        let ctx = nodes[i],
            updates = (ctx.updates = {});

        for (let a = 0, n = ATTRS.length; a < n; a++) {
            updates[ATTRS[a]] = 'v' + i;
        }

        if (!ctx.updating) {
            ctx.updating = true;
            queue.push(ctx);
        }

        ticks.add(() => {
            ctx.scheduled = false;
            ctx.textnode.nodeValue = 'v' + i;
        });
    }

    for (let i = 0, n = queue.length; i < n; i++) {
        let ctx = queue[i],
            updates = ctx.updates;

        for (let name in updates) {
            let value = updates[name];

            if (value !== null) {
                paint(ctx, name, value);
            }
        }

        ctx.updates = {};
        ctx.updating = false;
    }

    for (let tick of ticks) {
        tick();
    }
}

// Unified model: one queue, one drain, reused updates buffer (null-out, no realloc), inline slot text write, tick folded into the same pass
function frameUnified(nodes: Ctx[], dirty: number) {
    let queue: Ctx[] = [];

    for (let i = 0; i < dirty; i++) {
        let ctx = nodes[i],
            updates = ctx.updates;

        for (let a = 0, n = ATTRS.length; a < n; a++) {
            updates[ATTRS[a]] = 'v' + i;
        }

        if (!ctx.updating) {
            ctx.updating = true;
            queue.push(ctx);
        }
    }

    for (let i = 0, n = queue.length; i < n; i++) {
        let ctx = queue[i],
            updates = ctx.updates;

        for (let name in updates) {
            let value = updates[name];

            if (value !== null) {
                paint(ctx, name, value);
                updates[name] = null;
            }
        }

        ctx.textnode.nodeValue = 'v' + i;
        ctx.updating = false;
    }
}


describe('scheduling — sparse (1% dirty)', () => {
    let nodes = build(NODES);

    bench('current (3 loops + per-slot closures)', () => {
        frameCurrent(nodes, SPARSE);
    });

    bench('unified (1 drain, pooled buffers)', () => {
        frameUnified(nodes, SPARSE);
    });
});


describe('scheduling — dense (100% dirty)', () => {
    let nodes = build(NODES);

    bench('current (3 loops + per-slot closures)', () => {
        frameCurrent(nodes, DENSE);
    });

    bench('unified (1 drain, pooled buffers)', () => {
        frameUnified(nodes, DENSE);
    });
});


describe('invalidation — poll-all vs push-queue (1% dirty)', () => {
    let nodes = build(NODES);

    for (let i = 0, n = nodes.length; i < n; i++) {
        nodes[i].updating = i < SPARSE;
    }

    bench('poll-all (ECS: scan every node each tick)', () => {
        for (let i = 0, n = nodes.length; i < n; i++) {
            let ctx = nodes[i];

            if (!ctx.updating) {
                continue;
            }

            for (let a = 0, len = ATTRS.length; a < len; a++) {
                paint(ctx, ATTRS[a], 'v' + i);
            }
        }
    });

    bench('push-queue (drain only dirty)', () => {
        let queue: Ctx[] = [];

        for (let i = 0; i < SPARSE; i++) {
            queue.push(nodes[i]);
        }

        for (let i = 0, n = queue.length; i < n; i++) {
            let ctx = queue[i];

            for (let a = 0, len = ATTRS.length; a < len; a++) {
                paint(ctx, ATTRS[a], 'v' + i);
            }
        }
    });
});
