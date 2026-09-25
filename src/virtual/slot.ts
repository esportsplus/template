import { reactive, read, signal, write, Reactive } from '@esportsplus/reactivity';
import { onconnect } from '../event';
import { ArraySlot } from '../slot/array';
import { ondisconnect } from '../slot/cleanup';
import { subscribeArray } from '../slot/subscriptions';
import { Element } from '../types';
import { clone, EMPTY_FRAGMENT, marker as MARKER, raf, untracked } from '../utilities';
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


class VirtualSlot<T> {
    private anchored: boolean;
    private array: Reactive<T[]>;
    private arraySlot: ArraySlot<T>;
    private cache: Cache;
    private connected = false;
    private direction = 0;
    private dirty = false;
    private disposed = false;
    private end = 0;
    private frame: number | null = null;
    private hostCleanups: VoidFunction[] = [];
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
    private unsubscribers: VoidFunction[] = [];
    private viewportElement: Element | null = null;
    private viewportSize = 0;
    private windowed: Reactive<T[]>;
    private written = -1;


    readonly fragment: DocumentFragment;


    constructor(array: Reactive<T[]>, template: (value: T) => DocumentFragment | Text, options: VirtualOptions = {}) {
        this.anchored = options.anchor === 'end';
        this.array = array;
        this.cache = create(untracked(array).length, 200);
        this.lengthSignal = signal(untracked(array).length);
        this.rangeSignal = signal<[number, number]>([0, 0]);
        this.windowed = reactive([] as T[]);

        let fragment = this.fragment = clone(EMPTY_FRAGMENT) as DocumentFragment;

        this.marker = MARKER.cloneNode() as unknown as Element;
        this.spacerTop = document.createElement('div');
        this.spacerBottom = document.createElement('div');

        this.arraySlot = new ArraySlot(this.windowed, (value) => {
            let frag = template(value),
                head = frag.firstChild as unknown as Element;

            if (head) {
                (head as any)[SLOT] = this;
                ondisconnect(head, () => unobserve(head));
            }

            return frag;
        });

        fragment.append(this.marker);
        fragment.append(this.spacerTop);
        fragment.append(this.arraySlot.fragment);
        fragment.append(this.spacerBottom);

        ondisconnect(this.marker, () => this.dispose());

        this.unsubscribers.push(
            subscribeArray(array, 'clear', () => {
                this.removed(0, this.cache.length);
                this.reset = true;
                this.refresh();
            }),
            subscribeArray(array, 'concat', ({ items }) => {
                this.inserted(untracked(array).length - items.length, items.length);
                this.refresh();
            }),
            subscribeArray(array, 'pop', () => {
                this.removed(untracked(array).length, 1);
                this.refresh();
            }),
            subscribeArray(array, 'push', ({ items }) => {
                this.inserted(untracked(array).length - items.length, items.length);
                this.refresh();
            }),
            subscribeArray(array, 'reverse', () => {
                this.permuteReverse();
                this.refresh();
            }),
            subscribeArray(array, 'set', () => {
                this.replaced();
                this.refresh();
            }),
            subscribeArray(array, 'shift', () => {
                this.removed(0, 1);
                this.refresh();
            }),
            subscribeArray(array, 'sort', ({ order }) => {
                this.permuteSort(order);
                this.refresh();
            }),
            // ReactiveArray dispatches the resolved start and the count actually removed
            subscribeArray(array, 'splice', ({ deleteCount, items, start }) => {
                this.combine(start, deleteCount, items.length);
                this.refresh();
            }),
            subscribeArray(array, 'unshift', ({ items }) => {
                this.inserted(0, items.length);
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

        if (this.scroller === window) {
            window.scrollTo(0, this.listTop + next);
        }
        else {
            (this.scroller as HTMLElement).scrollTop = this.listTop + next;
        }
    }

    private applyRange(start: number, end: number) {
        if (!this.reset && start === this.start && end === this.end) {
            if (this.dirty) {
                this.patch(start);
            }

            if (this.dirty || this.resync) {
                this.arraySlot.flush();
                this.sync();

                this.resync = false;
            }

            return;
        }

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

        if (this.dirty) {
            this.patch(start);
        }

        this.arraySlot.flush();
        this.sync();

        this.resync = false;
    }

    private clampIndex(value: number, length: number) {
        return clamp(value, 0, length - 1);
    }

    private clampOffset(value: number) {
        let max = offset(this.cache, this.cache.length) - this.viewportSize;

        return clamp(value, 0, max < 0 ? 0 : max);
    }

    private anchor(): number {
        return offset(this.cache, this.start);
    }

    private atEnd(): boolean {
        return this.offset + this.viewportSize >= offset(this.cache, this.cache.length) - 1;
    }

    private combine(at: number, count: number, added: number) {
        let cache = this.cache,
            before = this.anchor();

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

        this.jump += this.anchor() - before;
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

        if (this.frame !== null) {
            globalThis.cancelAnimationFrame(this.frame);
            this.frame = null;
        }

        this.scheduled = false;

        this.releaseHost();

        let unsubscribers = this.unsubscribers;

        this.unsubscribers = [];

        for (let i = 0, n = unsubscribers.length; i < n; i++) {
            unsubscribers[i]();
        }

        this.arraySlot.dispose();
        this.windowed.dispose();

        this.spacerTop.remove();
        this.spacerBottom.remove();
    }

    private ensureHost() {
        if (this.marker.parentElement !== this.hostParent) {
            this.releaseHost();
            this.resolve();
        }
    }

    private inserted(at: number, count: number) {
        if (count <= 0) {
            return;
        }

        let before = this.anchor();

        insert(this.cache, at, count);

        if (at <= this.start) {
            this.renumber(count);
        }
        else if (at < this.end) {
            this.dirty = true;
        }

        this.jump += this.anchor() - before;
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

        let items = new Array<T>(j - i + 1);

        for (let k = i; k <= j; k++) {
            items[k - i] = desired[start + k];
        }

        current.splice(i, j - i + 1, ...items);
    }

    private permuteReverse() {
        let length = this.cache.length,
            sizes = new Array<number>(length);

        for (let i = 0; i < length; i++) {
            sizes[i] = this.cache.sizes[length - 1 - i];
        }

        reorder(this.cache, sizes);

        this.reset = true;
    }

    private permuteSort(order: number[]) {
        let length = this.cache.length,
            sizes = new Array<number>(length);

        for (let i = 0; i < length; i++) {
            let source = order[i];

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

    private releaseHost() {
        let cleanups = this.hostCleanups;

        this.hostCleanups = [];

        for (let i = 0, n = cleanups.length; i < n; i++) {
            cleanups[i]();
        }

        if (this.viewportElement) {
            unobserve(this.viewportElement);
            this.viewportElement = null;
        }
    }

    private removed(at: number, count: number) {
        if (count <= 0) {
            return;
        }

        let before = this.anchor();

        remove(this.cache, at, count);

        if (at + count <= this.start) {
            this.renumber(-count);
        }
        else if (at < this.end) {
            this.dirty = true;
        }

        this.jump += this.anchor() - before;
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

        start = this.clampIndex(start, length);
        end = clamp(end, start + 1, length);

        this.applyRange(start, end);
        this.updateSpacers();
    }

    private replaced() {
        this.dirty = true;
    }

    resized(index: number, height: number) {
        if (this.disposed || index < 0 || index >= this.cache.length) {
            return;
        }

        // Anchor on row `start`: a measurement, or the estimate drift it triggers, moves rows
        // below it by however much its offset moved, so the viewport follows by the same amount.
        // Rows inside the window never move the anchor, which is what makes backward scroll safe.
        let before = this.anchor();

        set(this.cache, index, height);

        this.jump += this.anchor() - before;
    }

    private resolve() {
        let scroller = findScroller(this.marker);

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

            window.addEventListener('resize', resize, { passive: true });
            this.hostCleanups.push(() => window.removeEventListener('resize', resize));
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

        target.addEventListener('scroll', scroll, { passive: true });
        this.hostCleanups.push(() => target.removeEventListener('scroll', scroll));
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

        this.frame = raf(() => {
            this.frame = null;
            this.run();
        });
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

        if (this.scroller === window) {
            window.scrollTo(0, this.listTop + value);
        }
        else {
            (this.scroller as HTMLElement).scrollTop = this.listTop + value;
        }

        this.offset = this.readOffset();
        this.written = this.offset === before ? -1 : this.offset;
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
