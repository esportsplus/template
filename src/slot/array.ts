import { read, root, signal, write, Reactive } from '@esportsplus/reactivity';
import { ARRAY_SLOT } from '../constants';
import { Element, SlotGroup } from '../types';
import { clone, EMPTY_FRAGMENT, marker, untracked } from '../utilities';
import { context, detach, enter, exit, ondisconnect, release, throws, track } from './cleanup';
import type { Slot } from './cleanup';


type ArraySlotOp<T> =
    | { items: T[]; op: 'concat' }
    | { deleteCount: number; items: T[]; op: 'splice'; start: number }
    | { items: T[]; op: 'push' }
    | { index: number; item: T; op: 'set' }
    | { items: T[]; op: 'unshift' }
    | { op: 'clear' }
    | { op: 'pop' }
    | { op: 'reverse' }
    | { op: 'shift' }
    | { op: 'sort'; order: number[] };

// A row: its nodes and the root that owns everything its template bound
type Item = Slot & SlotGroup;


// Releases rows and leaves their nodes in place
function dispose(items: Item[]) {
    throws(releases(items));
}

function lis(arr: number[]): Set<number> {
    let n = arr.length;

    if (n === 0) {
        return new Set();
    }

    let ends = new Int32Array(n),
        predecessors = new Int32Array(n),
        len = 0;

    for (let i = 0; i < n; i++) {
        let lo = 0,
            hi = len,
            val = arr[i];

        while (lo < hi) {
            let mid = (lo + hi) >> 1;

            if (arr[ends[mid]] < val) {
                lo = mid + 1;
            }
            else {
                hi = mid;
            }
        }

        ends[lo] = i;
        predecessors[i] = lo > 0 ? ends[lo - 1] : -1;

        if (lo >= len) {
            len = lo + 1;
        }
    }

    let idx = ends[len - 1],
        result = new Set<number>();

    for (let i = len - 1; i >= 0; i--) {
        result.add(idx);
        idx = predecessors[idx];
    }

    return result;
}


function releases(items: Item[]): unknown[] | null {
    let errors: unknown[] | null = null;

    for (let i = 0, n = items.length; i < n; i++) {
        errors = release(items[i], errors);
    }

    return errors;
}

// Releases rows, then removes their nodes
function remove(items: Item[]) {
    let errors = releases(items);

    for (let i = 0, n = items.length; i < n; i++) {
        detach(items[i]);
    }

    throws(errors);
}


class ArraySlot<T> implements Slot {
    anchor: Element;
    disposed = false;
    private nodes: Item[] = [];
    parent: Slot | null;
    private queue: ArraySlotOp<T>[] = [];
    private scheduled = false;
    private signal;
    private soleChild: boolean;
    state = 0;
    private template: (value: T) => Item;
    private unsubscribe: VoidFunction[] = [];

    readonly fragment: DocumentFragment;


    // 'managed': the slot's owner (a VirtualSlot) disposes it, so it registers nothing on the running owner
    constructor(private array: Reactive<T[]>, template: (value: T) => DocumentFragment | Text, soleChild: boolean = false, managed: boolean = false) {
        let fragment = this.fragment = clone(EMPTY_FRAGMENT),
            slot = this;

        this.anchor = marker.cloneNode() as unknown as Element;
        this.parent = context();
        this.signal = signal(untracked(array).length);
        this.soleChild = soleChild;
        // Each row gets a root of its own, outside any owner: rows come and go with the array, and dispose()
        // releases the ones left
        this.template = function (data) {
            let item = {
                    anchor: null,
                    disposed: false,
                    head: null,
                    parent: slot,
                    release: null,
                    state: 0,
                    tail: null
                } as unknown as Item,
                frag = root((dispose) => {
                    let parent = enter(item);

                    item.release = dispose;

                    try {
                        return template(data);
                    }
                    finally {
                        exit(parent);
                    }
                });

            item.anchor = item.head = frag.firstChild as unknown as Element;
            item.tail = frag.lastChild as unknown as Element;
            fragment.append(frag);

            return item;
        };

        fragment.append(this.anchor);

        if (!managed) {
            ondisconnect(this.anchor, () => this.dispose());
            track(this);
        }

        if (untracked(array).length) {
            root(() => {
                let n = untracked(array).length,
                    nodes = new Array<Item>(n);

                for (let i = 0; i < n; i++) {
                    nodes[i] = this.template(array[i]);
                }

                this.nodes = nodes;
            });
        }

        this.unsubscribe.push(
            array.on('clear', () => {
                this.queue.length = 0;
                this.schedule({ op: 'clear' });
            }),
            array.on('concat', ({ items }) => {
                this.schedule({ items, op: 'concat' });
            }),
            array.on('pop', () => {
                this.schedule({ op: 'pop' });
            }),
            array.on('push', ({ items }) => {
                this.schedule({ items, op: 'push' });
            }),
            array.on('reverse', () => {
                this.schedule({ op: 'reverse' });
            }),
            array.on('set', ({ index, item }) => {
                this.schedule({ op: 'set', item, index });
            }),
            array.on('shift', () => {
                this.schedule({ op: 'shift' });
            }),
            array.on('sort', ({ order }) => {
                this.schedule({ op: 'sort', order });
            }),
            array.on('splice', ({ deleteCount, items, start }) => {
                this.schedule({ deleteCount, items, op: 'splice', start });
            }),
            array.on('unshift', ({ items }) => {
                this.schedule({ items, op: 'unshift' });
            })
        );
    }


    private clear() {
        if (this.soleChild) {
            let parent = this.anchor.parentNode;

            if (parent) {
                dispose(this.nodes.splice(0));
                parent.textContent = '';
                parent.append(this.anchor);
                return;
            }
        }

        remove(this.nodes.splice(0));
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        this.queue = [];
        this.scheduled = false;

        let unsubscribe = this.unsubscribe;

        this.unsubscribe = [];

        for (let i = 0, n = unsubscribe.length; i < n; i++) {
            unsubscribe[i]();
        }

        dispose(this.nodes.splice(0));
    }

    flush() {
        if (this.disposed || !this.scheduled) {
            return;
        }

        this.run();
    }

    // The node a row inserted after 'index' goes after
    private last(index: number = this.nodes.length - 1) {
        let node = this.nodes[index];

        if (node) {
            return node.tail || node.head;
        }

        return this.anchor;
    }

    private pop() {
        let group = this.nodes.pop();

        if (group) {
            remove([group]);
        }
    }

    private push(items: T[]) {
        let anchor = this.last(),
            nodes = this.nodes;

        for (let i = 0, n = items.length; i < n; i++) {
            nodes.push(this.template(items[i]));
        }

        anchor.after(this.fragment);
    }

    release() {
        this.dispose();
    }

    private run() {
        this.scheduled = false;

        if (this.disposed) {
            this.queue = [];
            return;
        }

        let queue = this.queue;

        this.queue = [];

        root(() => {
            for (let i = 0, n = queue.length; i < n; i++) {
                let op = queue[i];

                switch (op.op) {
                    case 'clear':
                        this.clear();
                        break;
                    case 'concat':
                        this.push(op.items);
                        break;
                    case 'pop':
                        this.pop();
                        break;
                    case 'push':
                        this.push(op.items);
                        break;
                    case 'reverse':
                        this.nodes.reverse();
                        this.sync();
                        break;
                    case 'set':
                        this.splice(op.index, 1, [op.item]);
                        break;
                    case 'shift':
                        this.shift();
                        break;
                    case 'sort':
                        this.sort(op.order);
                        break;
                    case 'splice':
                        this.splice(op.start, op.deleteCount, op.items);
                        break;
                    case 'unshift':
                        this.unshift(op.items);
                        break;
                }
            }
        });

        write(this.signal, this.nodes.length);
    }

    private schedule(op: ArraySlotOp<T>) {
        this.queue.push(op);

        if (this.scheduled) {
            return;
        }

        this.scheduled = true;

        // Every change made in this task lands in one pass at its end; a flush() before then has
        // already run it.
        queueMicrotask(() => {
            if (this.scheduled) {
                this.run();
            }
        });
    }

    private shift() {
        let group = this.nodes.shift();

        if (group) {
            remove([group]);
        }
    }

    private sort(order: number[]) {
        let nodes = this.nodes,
            n = nodes.length;

        if (n !== order.length) {
            remove(nodes.splice(0));

            let m = untracked(this.array).length,
                rebuilt = new Array<Item>(m);

            for (let i = 0; i < m; i++) {
                rebuilt[i] = this.template(this.array[i]);
            }

            this.nodes = rebuilt;
            this.anchor.after(this.fragment);
            return;
        }

        let end: Node | null = n > 0 ? nodes[n - 1].tail.nextSibling : null,
            keep = lis(order),
            parent = this.anchor.parentNode,
            sorted = new Array(n) as Item[];

        for (let i = 0; i < n; i++) {
            sorted[i] = nodes[order[i]];
        }

        this.nodes = sorted;

        if (!parent || keep.size === n) {
            return;
        }

        let ref: Node | null = end,
            useMoveBefore = parent.isConnected && 'moveBefore' in parent;

        for (let i = n - 1; i >= 0; i--) {
            let group = sorted[i];

            if (keep.has(i)) {
                ref = group.head;
                continue;
            }

            let node: Node | null = group.tail;

            while (node) {
                let prev: Node | null = node === group.head ? null : node.previousSibling;

                if (useMoveBefore) {
                    (parent as any).moveBefore(node, ref);
                }
                else {
                    parent.insertBefore(node, ref);
                }

                ref = node;
                node = prev;
            }
        }
    }

    private splice(start: number, deleteCount: number = this.nodes.length, items: T[]) {
        let nodes = this.nodes;

        remove(nodes.splice(start, deleteCount));

        if (!items.length) {
            return;
        }

        let rest = nodes.splice(start);

        for (let i = 0, n = items.length; i < n; i++) {
            nodes.push(this.template(items[i]));
        }

        for (let i = 0, n = rest.length; i < n; i++) {
            nodes.push(rest[i]);
        }

        this.last(start - 1).after(this.fragment);
    }

    private sync() {
        let nodes = this.nodes,
            n = nodes.length;

        if (!n) {
            return;
        }

        let parent = this.anchor.parentNode;

        if (parent && parent.isConnected && 'moveBefore' in parent) {
            let ref: Node | null = nodes[0].tail.nextSibling;

            for (let i = n - 1; i >= 0; i--) {
                let group = nodes[i],
                    node: Node | null = group.tail;

                while (node) {
                    let prev: Node | null = node === group.head ? null : node.previousSibling;

                    (parent as any).moveBefore(node, ref);
                    ref = node;
                    node = prev;
                }
            }

            return;
        }

        for (let i = 0; i < n; i++) {
            let group = nodes[i],
                next: Node | null,
                node: Node | null = group.head;

            while (node) {
                next = node === group.tail ? null : node.nextSibling;
                this.fragment.append(node);
                node = next;
            }
        }

        this.anchor.after(this.fragment);
    }

    private unshift(items: T[]) {
        let groups = new Array<Item>(items.length);

        for (let i = 0, n = items.length; i < n; i++) {
            groups[i] = this.template(items[i]);
        }

        this.nodes = groups.concat(this.nodes);
        this.anchor.after(this.fragment);
    }


    get length() {
        return read(this.signal);
    }
}

Object.defineProperty(ArraySlot.prototype, ARRAY_SLOT, { value: true });


export { ArraySlot };
