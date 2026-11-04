import { owner, Reactive, root } from '@esportsplus/reactivity';
import type { ArrayOp } from '@esportsplus/reactivity';
import { ARRAY_SLOT } from '../constants';
import { Element, SlotGroup } from '../types';
import { clone, EMPTY_FRAGMENT, marker, untracked } from '../utilities';
import { detach, ondisconnect, own, release, report, throws, track } from './cleanup';
import type { Owner, Slot } from './cleanup';


// A row: its nodes and the root that owns everything its template bound
type Item = Slot & SlotGroup;


const EMPTY: never[] = [];


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
    private soleChild: boolean;
    state = 0;
    private template: (value: T) => Item;
    private unroot: VoidFunction;
    private unsubscribe: VoidFunction[] = [];
    within: Owner | null;

    readonly fragment: DocumentFragment;


    // 'managed': the slot's owner (a VirtualSlot) disposes it, so it registers nothing on the running owner
    constructor(private array: Reactive<T[]>, template: (value: T) => DocumentFragment | globalThis.Element | Text, soleChild: boolean = false, managed: boolean = false) {
        let fragment = this.fragment = clone(EMPTY_FRAGMENT),
            node!: Owner;

        this.anchor = marker.cloneNode() as unknown as Element;
        this.soleChild = soleChild;
        this.within = owner();
        // The owner rows are made within, so this slot is their parent; it owns nothing, the rows being roots of their own
        this.unroot = root((dispose) => {
            node = owner()!;
            own(this);

            return dispose;
        });
        // Each row gets a root of its own, outside any owner: rows come and go with the array, and dispose()
        // releases the ones left
        this.template = function (data) {
            let item = {
                    anchor: null,
                    disposed: false,
                    head: null,
                    release: null,
                    state: 0,
                    tail: null,
                    within: node
                } as unknown as Item,
                frag = root((dispose) => {
                    own(item);
                    item.release = dispose;

                    return template(data);
                });

            // A single-root row is its element, with no fragment around it
            if (frag.nodeType === 11) {
                item.anchor = item.head = frag.firstChild as unknown as Element;
                item.tail = frag.lastChild as unknown as Element;
            }
            else {
                item.anchor = item.head = item.tail = frag as unknown as Element;
            }

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
                this.nodes = this.rows();
            });
        }

        // Every change made in a task lands in one pass inside the reactivity pass that follows it; flush() settles it
        this.unsubscribe.push(array.on('batch', (ops) => this.apply(ops)));
    }


    private apply(ops: ArrayOp<T>[]) {
        if (this.disposed) {
            return;
        }

        let errors: unknown[] | null = null;

        // A change that throws (a released row's cleanup) is reported, never thrown: the array drops a listener that
        // throws, and the next change still has to land
        root(() => {
            for (let i = 0, n = ops.length; i < n; i++) {
                try {
                    this.change(ops[i]);
                }
                catch (e) {
                    (errors ??= []).push(e);
                }
            }
        });

        report(errors);
    }

    private change(op: ArrayOp<T>) {
        let n = this.nodes.length;

        switch (op.op) {
            case 'clear':
                this.clear();
                break;
            case 'concat':
            case 'push':
                this.splice(n, 0, op.items);
                break;
            case 'pop':
                this.splice(n - 1, 1, EMPTY);
                break;
            case 'reverse': {
                // oxlint-disable-next-line unicorn/no-new-array -- preallocated to its final length, every slot is written next
                let order = new Array<number>(n);

                for (let i = 0; i < n; i++) {
                    order[i] = n - 1 - i;
                }

                this.sort(order);
                break;
            }
            case 'set':
                this.splice(op.index, 1, [op.item]);
                break;
            case 'shift':
                this.splice(0, 1, EMPTY);
                break;
            case 'sort':
                this.sort(op.order);
                break;
            case 'splice':
                this.splice(op.start, op.deleteCount, op.items);
                break;
            case 'unshift':
                this.splice(0, 0, op.items);
                break;
        }
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

        let unsubscribe = this.unsubscribe;

        this.unsubscribe = [];

        for (let i = 0, n = unsubscribe.length; i < n; i++) {
            unsubscribe[i]();
        }

        try {
            dispose(this.nodes.splice(0));
        }
        finally {
            this.unroot();
        }
    }

    // The node a row inserted after 'index' goes after
    private last(index: number) {
        let node = this.nodes[index];

        return node ? node.tail : this.anchor;
    }

    release() {
        this.dispose();
    }

    private rows() {
        let array = this.array,
            n = untracked(array).length,
            // oxlint-disable-next-line unicorn/no-new-array -- preallocated to its final length, every slot is written next
            nodes = new Array<Item>(n);

        for (let i = 0; i < n; i++) {
            nodes[i] = this.template(array[i]);
        }

        return nodes;
    }

    private sort(order: number[]) {
        let nodes = this.nodes,
            n = nodes.length;

        if (n !== order.length) {
            remove(nodes.splice(0));
            this.nodes = this.rows();
            this.anchor.after(this.fragment);
            return;
        }

        let end: Node | null = n > 0 ? nodes[n - 1].tail.nextSibling : null,
            keep = lis(order),
            parent = this.anchor.parentNode,
            // oxlint-disable-next-line unicorn/no-new-array -- preallocated to its final length, every slot is written next
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

    private splice(start: number, deleteCount: number, items: T[]) {
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

    // The array's length, which runs ahead of the rendered rows only between a change and the pass that renders it
    get length() {
        return this.array.$length;
    }
}

Object.defineProperty(ArraySlot.prototype, ARRAY_SLOT, { value: true });


export { ArraySlot };
