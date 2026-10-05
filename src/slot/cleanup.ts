import { hasOwner, onCleanup, read, signal, write } from '@esportsplus/reactivity';
import { CLEANUP, PACKAGE_NAME } from '../constants';
import { Element, SlotGroup } from '../types';


// A unit of ownership with a node that is in the document exactly while its content is: render() roots, array,
// virtual and effect slots, array items, HMR instances, and the bindings a guard checks (host events, reactive
// attributes). Climbing parent pointers finds the outermost one foreign code took out of the document.
interface Slot {
    anchor: Node;
    disposed: boolean;
    parent: Slot | null;
    state: number;
    // Releases what the slot owns and leaves its nodes alone; idempotent
    release(): void;
}

type Orphan = Node & { [CLEANUP]?: VoidFunction[] };


// Unmounted sweeps a tracked slot may stay out of the document before it stops being tracked, counted above the flags
const AGE = 16;

const MOUNTED = 1;

const QUEUED = 2;

const SWEEP_DELAY = 1000;

const SWEEP_LIMIT = 60;

const TRACKED = 4;


let cursor = 0,
    // One long task can create and dispose many slots with no sweep in between to drop them
    compactAt = 1024,
    // The slot whose content is being built: the parent of every slot created meanwhile
    current: Slot | null = null,
    healing: Slot[] = [],
    idle: (fn: (deadline?: IdleDeadline) => void) => void = typeof requestIdleCallback === 'function'
        ? (fn) => requestIdleCallback(fn, { timeout: SWEEP_DELAY })
        : (fn) => setTimeout(fn, 0),
    kept = 0,
    orphans: Orphan[] = [],
    // Read by every guarded effect that skipped a run, so one found back in the document runs again
    revival = signal(0),
    scheduled = false,
    sweeping = false,
    tracked: Slot[] = [];


function climb(slot: Slot): Slot | null {
    if (slot.disposed || slot.anchor.isConnected) {
        return null;
    }

    let parent = slot.parent;

    while (parent !== null && !parent.disposed && !parent.anchor.isConnected) {
        slot = parent;
        parent = slot.parent;
    }

    return slot;
}

function compact() {
    let n = 0;

    for (let i = 0, m = tracked.length; i < m; i++) {
        let slot = tracked[i];

        if (slot.disposed) {
            slot.state &= ~TRACKED;
        }
        else {
            tracked[n++] = slot;
        }
    }

    tracked.length = n;
    compactAt = n * 2 > 1024 ? n * 2 : 1024;
}

function drain(fns: VoidFunction[], errors: unknown[] | null): unknown[] | null {
    for (let i = 0, n = fns.length; i < n; i++) {
        try {
            fns[i]();
        }
        catch (e) {
            (errors ??= []).push(e);
        }
    }

    return errors;
}

function heals() {
    let errors: unknown[] | null = null,
        moved = false,
        queue = healing;

    healing = [];

    for (let i = 0, n = queue.length; i < n; i++) {
        let slot = queue[i];

        slot.state &= ~QUEUED;

        if (slot.disposed) {
            continue;
        }

        // Back in the document by the end of the task: it was moved, not removed
        if (slot.anchor.isConnected) {
            moved = true;
            continue;
        }

        errors = release(climb(slot), errors);
    }

    if (moved) {
        write(revival, revival.value + 1);
    }

    report(errors);
}

// Content no owner was building has nowhere to register, so its cleanups wait on its nodes for the template insertion
// that adopts them; still unadopted at the next sweep, each node is tracked like a slot of its own.
function orphan(node: Orphan, fn: VoidFunction) {
    let fns = node[CLEANUP];

    if (fns !== undefined) {
        fns.push(fn);
        return;
    }

    node[CLEANUP] = [fn];
    orphans.push(node);

    if (!scheduled) {
        schedule(SWEEP_DELAY);
    }
}

function release(slot: Slot | null, errors: unknown[] | null): unknown[] | null {
    if (slot === null || slot.disposed) {
        return errors;
    }

    try {
        slot.release();
    }
    catch (e) {
        (errors ??= []).push(e);
    }

    slot.disposed = true;

    return errors;
}

// Heals and sweeps run where no caller could catch, so their errors are reported, never thrown
function report(errors: unknown[] | null) {
    if (errors === null) {
        return;
    }

    let error = errors.length === 1
            ? new Error(`${PACKAGE_NAME}: cleanup of removed content threw`, { cause: errors[0] })
            : new AggregateError(errors, `${PACKAGE_NAME}: cleanup of removed content produced multiple errors`);

    if (typeof reportError === 'function') {
        reportError(error);
    }
    else {
        setTimeout(() => {
            throw error;
        }, 0);
    }
}

function schedule(delay: number) {
    scheduled = true;

    if (delay) {
        setTimeout(() => idle(tick), delay);
    }
    else {
        idle(tick);
    }
}

function settle() {
    let nodes = orphans;

    if (nodes.length === 0) {
        return;
    }

    orphans = [];

    for (let i = 0, n = nodes.length; i < n; i++) {
        let node = nodes[i];

        if (node[CLEANUP] === undefined) {
            continue;
        }

        let slot: Slot = {
                anchor: node,
                disposed: false,
                parent: null,
                release: () => {
                    let fns = node[CLEANUP];

                    if (fns === undefined) {
                        return;
                    }

                    node[CLEANUP] = undefined;

                    throws(drain(fns, null));
                },
                state: 0
            };

        track(slot);
    }
}

function tick(deadline?: IdleDeadline) {
    scheduled = false;
    sweep(deadline);
}

function throws(errors: unknown[] | null) {
    if (errors !== null) {
        throw errors.length === 1
            ? errors[0]
            : new AggregateError(errors, `${PACKAGE_NAME}: cleanup produced multiple errors`);
    }
}


// Hands the orphaned cleanups of nodes inside 'content' to the running owner; call before 'content' is inserted
const adopt = (content: Node) => {
    let fns = claim(content);

    if (fns !== null) {
        for (let i = 0, n = fns.length; i < n; i++) {
            onCleanup(fns[i]);
        }
    }
};

// Takes the orphaned cleanups of nodes inside 'content', in registration order per node
const claim = (content: Node): VoidFunction[] | null => {
    if (orphans.length === 0) {
        return null;
    }

    let claimed: VoidFunction[] | null = null;

    for (let i = 0; i < orphans.length; i++) {
        let node = orphans[i];

        if (!content.contains(node)) {
            continue;
        }

        let fns = node[CLEANUP]!;

        node[CLEANUP] = undefined;
        orphans[i--] = orphans[orphans.length - 1];
        orphans.pop();
        claimed = claimed === null ? fns : claimed.concat(fns);
    }

    return claimed;
};

const context = () => current;

const detach = (group: SlotGroup) => {
    let head = group.head,
        node: ChildNode | null = group.tail as ChildNode;

    while (node) {
        let prev: ChildNode | null = node === head ? null : node.previousSibling;

        node.remove();
        node = prev;
    }
};

// Makes 'slot' the parent of every slot created until exit(); the caller provides the reactivity owner
const enter = (slot: Slot) => {
    let parent = current;

    current = slot;

    return parent;
};

const exit = (parent: Slot | null) => {
    current = parent;
};

// Queues the outermost slot foreign code took out of the document along with 'slot'; it is released at the end of the
// task unless it is back by then
const heal = (slot: Slot) => {
    if (slot.state & QUEUED) {
        return;
    }

    slot.state |= QUEUED;

    if (healing.push(slot) === 1) {
        queueMicrotask(heals);
    }
};

// Lands on the reactivity owner running now (a root's scope or a computed/effect run), or waits on the node when there
// is none
const ondisconnect = (node: Element | Node, fn: VoidFunction) => {
    if (hasOwner()) {
        onCleanup(fn);
    }
    else {
        orphan(node as Orphan, fn);
    }
};

// Called by a guarded effect in place of its run while its anchor is out of the document after being in it
const stale = (slot: Slot) => {
    read(revival);
    heal(slot);
};

// Runs every cleanup even when one throws
const run = (fns: VoidFunction[]) => {
    throws(drain(fns, null));
};

// Resumable across idle slices: entries before 'kept' survive, 'cursor' is the next one to visit. A slot seen in the
// document is marked mounted; a mounted slot found out of it was removed by foreign code, so the outermost such slot
// is released. Template removal releases slots itself, so they cost nothing here past being dropped.
const sweep = (deadline?: IdleDeadline) => {
    let errors: unknown[] | null = null,
        visited = 0;

    if (cursor === 0) {
        settle();
    }

    sweeping = true;

    for (; cursor < tracked.length; cursor++) {
        // A slice always makes progress, even one granted after its timeout with no time left
        if (deadline !== undefined && (++visited & 255) === 0 && deadline.timeRemaining() <= 0) {
            break;
        }

        let slot = tracked[cursor],
            state = slot.state;

        if (!slot.disposed) {
            if (slot.anchor.isConnected) {
                slot.state = state | MOUNTED;
                tracked[kept++] = slot;
                continue;
            }

            if (state & MOUNTED) {
                errors = release(climb(slot), errors);
            }
            else if (state < AGE * SWEEP_LIMIT) {
                slot.state = state + AGE;
                tracked[kept++] = slot;
                continue;
            }
        }

        slot.state &= ~TRACKED;
    }

    if (cursor === tracked.length) {
        tracked.length = kept;
        cursor = kept = 0;
    }

    sweeping = false;

    if (!scheduled && (tracked.length || orphans.length)) {
        schedule(cursor ? 0 : SWEEP_DELAY);
    }

    report(errors);
};

// Watches a top-level slot's anchor for foreign removal; the first sweep is lazy, and none is pending while nothing is
// tracked. A nested slot is released with the outermost slot removed along with it, or by its own guard, so only slots
// with no parent are watched.
const track = (slot: Slot) => {
    if (slot.parent !== null || slot.state & TRACKED) {
        return;
    }

    slot.state |= TRACKED;

    if (tracked.push(slot) >= compactAt && cursor === 0 && !sweeping) {
        compact();
    }

    if (!scheduled) {
        schedule(SWEEP_DELAY);
    }
};

// Registers a disposer only when no owner would otherwise reach it: an effect created under an owner is owned by it
const unowned = (node: Element | Node, fn: VoidFunction) => {
    if (!hasOwner()) {
        orphan(node as Orphan, fn);
    }
};


export { adopt, claim, context, detach, enter, exit, heal, MOUNTED, ondisconnect, release, run, stale, sweep, throws, track, unowned };
export type { Slot };
