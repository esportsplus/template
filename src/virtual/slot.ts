import { flush, owner, Reactive, ReactiveArray, read, root, signal, write } from '@esportsplus/reactivity';
import { onconnect } from '../event';
import { ArraySlot } from '../slot/array';
import { ondisconnect, own, track } from '../slot/cleanup';
import type { Owner, Slot } from '../slot/cleanup';
import { Element } from '../types';
import { clone, EMPTY_FRAGMENT, marker as MARKER, untracked } from '../utilities';
import { create, index, insert, offset, remove, reorder, set, size } from './cache';
import type { Cache } from './cache';
import { INDEX, observe, SIZE, SLOT, unobserve } from './measure';


type Align = 'start' | 'center' | 'end';

type VirtualOptions = {
    anchor?: 'end' | 'start';
};


function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

function findScroller(node: Node): HTMLElement | Window {
    let element = node.parentElement;

    while (element) {
        let overflow = getComputedStyle(element).overflowY;

        if (overflow === 'auto' || overflow === 'scroll') {
            return element;
        }

        element = element.parentElement;
    }

    return window;
}


class VirtualSlot<T> implements Slot {
    private anchored: boolean;
    private array: Reactive<T[]>;
    private arraySlot: ArraySlot<T>;
    private cache: Cache;
    private connected = false;
    private direction = 0;
    private dirty = false;
    disposed = false;
    private end = 0;
    // Aborts the scroll/resize listeners of the current host
    private host: AbortController | null = null;
    private hostParent: HTMLElement | null = null;
    private jump = 0;
    private lengthSignal;
    private listTop = 0;
    private marker: Element;
    private offset = 0;
    private pending: { align: Align; index: number } | null = null;
    private pinned = false;
    private rangeSignal;
    private reset = false;
    private resync = false;
    private scheduled = false;
    private scroller: HTMLElement | Window = window;
    private spacerBottom: HTMLElement;
    private spacerTop: HTMLElement;
    private start = 0;
    state = 0;
    private unroot: VoidFunction;
    private unsubscribe: VoidFunction[] = [];
    private viewportElement: Element | null = null;
    private viewportSize = 0;
    private windowed: Reactive<T[]>;
    within: Owner | null;
    private written = -1;


    readonly fragment: DocumentFragment;


    constructor(array: Reactive<T[]>, template: (value: T) => DocumentFragment | globalThis.Element | Text, options: VirtualOptions = {}) {
        this.anchored = options.anchor === 'end';
        this.array = array;
        this.within = owner();
        this.cache = create(untracked(array).length, 200);
        this.lengthSignal = signal(untracked(array).length);
        this.rangeSignal = signal<[number, number]>([0, 0]);
        // Disposed by dispose(); built directly so nothing registers on the running owner
        this.windowed = new ReactiveArray<T>() as unknown as Reactive<T[]>;

        let fragment = this.fragment = clone(EMPTY_FRAGMENT) as DocumentFragment;

        this.marker = MARKER.cloneNode() as unknown as Element;
        this.spacerTop = document.createElement('div');
        this.spacerBottom = document.createElement('div');

        // Built within this slot's own owner, so this slot is its parent, and managed: dispose() disposes it
        let unroot!: VoidFunction;

        this.arraySlot = root((dispose) => {
            own(this);
            unroot = dispose;

            return new ArraySlot(this.windowed, (value) => {
                let frag = template(value),
                    head = (frag.nodeType === 11 ? frag.firstChild : frag) as unknown as Element;

                if (head) {
                    (head as any)[SLOT] = this;
                    ondisconnect(head, () => unobserve(head));
                }

                return frag;
            }, false, true);
        });
        this.unroot = unroot;

        fragment.append(this.marker);
        fragment.append(this.spacerTop);
        fragment.append(this.arraySlot.fragment);
        fragment.append(this.spacerBottom);

        ondisconnect(this.marker, () => this.dispose());
        track(this);

        // A task's changes in order: the size cache tracks the array through each, so every position is the one that
        // change saw. ReactiveArray reports a splice's resolved start and the count actually removed.
        this.unsubscribe.push(
            array.on('batch', (ops) => {
                for (let i = 0, n = ops.length; i < n; i++) {
                    let length = this.cache.length,
                        op = ops[i];

                    switch (op.op) {
                        case 'clear':
                            if (length > 0) {
                                this.combine(0, length, 0);
                            }

                            this.reset = true;
                            break;
                        case 'concat':
                        case 'push':
                            if (op.items.length > 0) {
                                this.combine(length, 0, op.items.length);
                            }
                            break;
                        case 'pop':
                            this.combine(length - 1, 1, 0);
                            break;
                        case 'reverse':
                            this.permute(null);
                            break;
                        case 'set':
                            this.dirty = true;
                            break;
                        case 'shift':
                            this.combine(0, 1, 0);
                            break;
                        case 'sort':
                            this.permute(op.order);
                            break;
                        case 'splice':
                            this.combine(op.start, op.deleteCount, op.items.length);
                            break;
                        case 'unshift':
                            if (op.items.length > 0) {
                                this.combine(0, 0, op.items.length);
                            }
                            break;
                    }
                }

                this.refresh();
            })
        );

        onconnect(this.marker, () => this.connect());
    }


    private adjustSpacers() {
        let parent = this.marker.parentElement,
            tag = parent ? parent.tagName : '';

        if ((tag === 'TBODY' || tag === 'THEAD' || tag === 'TFOOT' || tag === 'TABLE') && this.spacerTop.tagName !== 'TR') {
            let top = document.createElement('tr'),
                bottom = document.createElement('tr');

            this.spacerTop.replaceWith(top);
            this.spacerBottom.replaceWith(bottom);

            this.spacerTop = top;
            this.spacerBottom = bottom;
        }
    }

    private applyJump() {
        if (!this.jump) {
            return;
        }

        let max = offset(this.cache, this.cache.length) - this.viewportSize,
            next = this.offset + this.jump;

        if (max < 0) {
            max = 0;
        }

        next = clamp(next, 0, max);

        this.jump = 0;
        this.written = next === this.offset ? -1 : next;
        this.offset = next;
        this.scroll(next);
    }

    private applyRange(start: number, end: number) {
        let moved = this.reset || start !== this.start || end !== this.end;

        if (moved) {
            let oldStart = this.start,
                oldEnd = this.end;

            if (this.reset || end <= oldStart || start >= oldEnd) {
                this.windowed.splice(0, untracked(this.windowed).length, ...this.array.slice(start, end));
            }
            else {
                if (start < oldStart) {
                    this.windowed.unshift(...this.array.slice(start, oldStart));
                }
                else if (start > oldStart) {
                    this.windowed.splice(0, start - oldStart);
                }

                if (end > oldEnd) {
                    this.windowed.push(...this.array.slice(oldEnd, end));
                }
                else if (end < oldEnd) {
                    this.windowed.splice(untracked(this.windowed).length - (oldEnd - end), oldEnd - end);
                }
            }

            this.reset = false;
            this.start = start;
            this.end = end;

            write(this.rangeSignal, [start, end]);
        }

        if (this.dirty) {
            this.patch(start);
        }

        if (moved || this.dirty || this.resync) {
            flush();
            this.sync();

            this.resync = false;
        }
    }

    private clampOffset(value: number) {
        let max = offset(this.cache, this.cache.length) - this.viewportSize;

        return clamp(value, 0, max < 0 ? 0 : max);
    }

    private atEnd(): boolean {
        return this.offset + this.viewportSize >= offset(this.cache, this.cache.length) - 1;
    }

    private combine(at: number, count: number, added: number) {
        let cache = this.cache,
            before = this.top();

        if (count) {
            remove(cache, at, count);
        }

        if (added) {
            insert(cache, at, added);
        }

        if (at + count <= this.start) {
            this.renumber(added - count);
        }
        else if (at < this.end) {
            this.dirty = true;
        }

        this.jump += this.top() - before;
    }

    commit() {
        if (this.disposed) {
            return;
        }

        if (!this.connected) {
            this.updateSpacers();
            return;
        }

        this.ensureHost();

        this.render();
        this.applyJump();

        this.dirty = false;

        // A pinned reader follows the end through appends and late measurements alike, so the
        // target is always the current last row; the pin releases when a real scroll event
        // moves the viewport away from the end or a scrollTo asks for somewhere else
        if (this.pinned && this.cache.length) {
            this.pending = { align: 'end', index: this.cache.length - 1 };
        }

        this.settle();
    }

    private connect() {
        if (this.disposed || this.connected) {
            return;
        }

        this.connected = true;
        this.pinned = this.anchored;

        this.resolve();
        this.commit();
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.scheduled = false;

        this.releaseHost();

        let unsubscribe = this.unsubscribe;

        this.unsubscribe = [];

        for (let i = 0, n = unsubscribe.length; i < n; i++) {
            unsubscribe[i]();
        }

        try {
            this.arraySlot.dispose();
            this.windowed.dispose();
        }
        finally {
            this.unroot();
        }

        this.spacerTop.remove();
        this.spacerBottom.remove();
    }

    private ensureHost() {
        if (this.marker.parentElement !== this.hostParent) {
            this.releaseHost();
            this.resolve();
        }
    }

    // Renders a change made in this task now rather than at its end, for a caller about to measure the rows: settles the
    // reactivity pass that delivers the array's changes, then renders. Rendering waits for the end of that pass
    // otherwise, since measuring needs the rows the inner array slot builds inside it.
    flush() {
        flush();

        if (this.disposed || !this.scheduled) {
            return;
        }

        this.run();
    }

    private measureRendered(): boolean {
        let node: Node | null = this.spacerTop.nextSibling,
            measured = false;

        while (node && node !== this.spacerBottom) {
            let target = node as any;

            if (target[SLOT] === this && target[SIZE] === undefined) {
                let at = target[INDEX] as number | undefined;

                if (at !== undefined) {
                    let height = (node as HTMLElement).offsetHeight;

                    if (height > 0) {
                        target[SIZE] = height;
                        set(this.cache, at, height);
                        measured = true;
                    }
                }
            }

            node = node.nextSibling;
        }

        return measured;
    }

    private onScroll() {
        if (this.disposed || !this.connected) {
            return;
        }

        let value = this.readOffset();

        // A write produces at most one scroll event, so the guard is consumed by the first
        // match; a later genuine scroll landing on the same value must not be swallowed
        if (Math.abs(value - this.written) < 1) {
            this.written = -1;
            return;
        }

        this.written = -1;
        this.pending = null;

        let previous = this.offset;

        this.offset = value;
        this.direction = value > previous ? 1 : value < previous ? -1 : 0;
        this.pinned = this.anchored && this.atEnd();

        this.commit();
    }

    private patch(start: number) {
        let current = this.windowed,
            desired = this.array,
            n = untracked(current).length,
            i = 0;

        while (i < n && current[i] === desired[start + i]) {
            i++;
        }

        let j = n - 1;

        while (j >= i && current[j] === desired[start + j]) {
            j--;
        }

        if (i > j) {
            return;
        }

        // oxlint-disable-next-line unicorn/no-new-array -- preallocated to its final length, every slot is written next
        let items = new Array<T>(j - i + 1);

        for (let k = i; k <= j; k++) {
            items[k - i] = desired[start + k];
        }

        current.splice(i, j - i + 1, ...items);
    }

    // 'order' null reverses
    private permute(order: number[] | null) {
        let length = this.cache.length,
            // oxlint-disable-next-line unicorn/no-new-array -- preallocated to its final length, every slot is written next
            sizes = new Array<number>(length);

        for (let i = 0; i < length; i++) {
            let source = order === null ? length - 1 - i : order[i];

            sizes[i] = source >= 0 && source < length ? this.cache.sizes[source] : 0;
        }

        reorder(this.cache, sizes);

        this.reset = true;
    }

    private rangeMeasured() {
        for (let i = this.start; i < this.end; i++) {
            if (this.cache.sizes[i] === 0) {
                return false;
            }
        }

        return true;
    }

    private readOffset() {
        if (this.scroller === window) {
            return window.scrollY - this.listTop;
        }

        return (this.scroller as HTMLElement).scrollTop - this.listTop;
    }

    private refresh() {
        write(this.lengthSignal, untracked(this.array).length);
        this.schedule();
    }

    release() {
        this.dispose();
    }

    private releaseHost() {
        this.host?.abort();
        this.host = null;

        if (this.viewportElement) {
            unobserve(this.viewportElement);
            this.viewportElement = null;
        }
    }

    // A mutation entirely above the window moves the same rows to new indices: renumber
    // instead of rebuilding, and let the pending jump carry the viewport with them
    private renumber(delta: number) {
        this.start += delta;
        this.end += delta;
        this.resync = true;

        write(this.rangeSignal, [this.start, this.end]);
    }

    private render() {
        let length = this.cache.length;

        if (length <= 0) {
            this.applyRange(0, 0);
            this.updateSpacers();
            return;
        }

        // The pending jump is written right after this range is applied, so search from where
        // the viewport is about to be, not where it was
        let base = this.offset + this.jump,
            viewport = this.viewportSize,
            behind = this.direction === -1 ? viewport : 0,
            ahead = this.direction === -1 ? 0 : viewport,
            start = index(this.cache, Math.max(0, base - behind), this.start),
            end = index(this.cache, base + viewport + ahead, this.end - 1) + 1;

        start = clamp(start, 0, length - 1);
        end = clamp(end, start + 1, length);

        this.applyRange(start, end);
        this.updateSpacers();
    }

    resized(index: number, height: number) {
        if (this.disposed || index < 0 || index >= this.cache.length) {
            return;
        }

        // Anchor on row `start`: a measurement, or the estimate drift it triggers, moves rows
        // below it by however much its offset moved, so the viewport follows by the same amount.
        // Rows inside the window never move the anchor, which is what makes backward scroll safe.
        let before = this.top();

        set(this.cache, index, height);

        this.jump += this.top() - before;
    }

    private resolve() {
        let scroller = findScroller(this.marker);

        let host = this.host = new AbortController();

        this.scroller = scroller;
        this.hostParent = this.marker.parentElement;

        this.adjustSpacers();

        if (scroller === window) {
            this.listTop = this.spacerTop.getBoundingClientRect().top + window.scrollY;
            this.viewportSize = window.innerHeight;

            let resize = () => {
                this.viewportSize = window.innerHeight;
                this.commit();
            };

            window.addEventListener('resize', resize, { passive: true, signal: host.signal });
        }
        else {
            let element = scroller as HTMLElement;

            element.style.setProperty('overflow-anchor', 'none');

            this.listTop = this.spacerTop.getBoundingClientRect().top - element.getBoundingClientRect().top + element.scrollTop;
            this.viewportSize = element.clientHeight;

            observe(element as unknown as Element, this, undefined);

            this.viewportElement = element as unknown as Element;
        }

        this.offset = this.readOffset();
        this.written = this.offset;

        let target: EventTarget = this.scroller,
            scroll = () => this.onScroll();

        target.addEventListener('scroll', scroll, { passive: true, signal: host.signal });
    }

    private run() {
        this.scheduled = false;

        if (this.disposed) {
            return;
        }

        this.commit();
    }

    private schedule() {
        if (this.scheduled || this.disposed) {
            return;
        }

        this.scheduled = true;

        queueMicrotask(() => {
            if (this.scheduled) {
                this.run();
            }
        });
    }

    private scroll(value: number) {
        if (this.scroller === window) {
            window.scrollTo(0, this.listTop + value);
        }
        else {
            (this.scroller as HTMLElement).scrollTop = this.listTop + value;
        }
    }

    private scrollTarget(target: number, align: Align) {
        let top = offset(this.cache, target),
            height = size(this.cache, target);

        if (align === 'center') {
            return top - (this.viewportSize - height) / 2;
        }

        if (align === 'end') {
            return top + height - this.viewportSize;
        }

        return top;
    }

    scrollTo(target: number, align: Align = 'start') {
        if (this.disposed || !this.connected || this.cache.length === 0) {
            return;
        }

        this.pinned = false;
        this.pending = {
            align,
            index: clamp(target, 0, this.cache.length - 1)
        };

        this.commit();
        this.measureRendered();
    }

    private settle() {
        if (!this.pending) {
            return;
        }

        let { align, index: at } = this.pending,
            target = this.clampOffset(this.scrollTarget(at, align));

        if (Math.abs(target - this.offset) >= 1) {
            this.writeScroll(target);
            this.render();
            return;
        }

        if (this.rangeMeasured()) {
            this.pending = null;
            this.pinned = this.anchored && this.atEnd();
        }
    }

    private sync() {
        if (this.disposed) {
            return;
        }

        let node: Node | null = this.spacerTop.nextSibling,
            at = this.start;

        while (node && node !== this.spacerBottom) {
            if ((node as any)[SLOT] === this) {
                observe(node as unknown as Element, this, at);
                at++;
            }

            node = node.nextSibling;
        }
    }

    // Offset of the first rendered row
    private top(): number {
        return offset(this.cache, this.start);
    }

    private updateSpacers() {
        let total = offset(this.cache, this.cache.length),
            top = offset(this.cache, this.start),
            bottom = total - offset(this.cache, this.end);

        this.spacerTop.style.height = top + 'px';
        this.spacerBottom.style.height = (bottom < 0 ? 0 : bottom) + 'px';
    }

    viewport(height: number) {
        if (this.disposed) {
            return;
        }

        this.viewportSize = height;
    }

    private writeScroll(value: number) {
        let before = this.offset;

        this.scroll(value);
        this.offset = this.readOffset();
        this.written = this.offset === before ? -1 : this.offset;
    }


    get anchor() {
        return this.marker;
    }

    get length() {
        return read(this.lengthSignal);
    }

    get range() {
        return read(this.rangeSignal);
    }
}


export { VirtualSlot };
export type { VirtualOptions };
