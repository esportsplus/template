import { read, root, set, signal, ReactiveArray } from '@esportsplus/reactivity';
import { ARRAY_SLOT, EMPTY_FRAGMENT } from '~/constants';
import { Element, SlotGroup } from '~/types';
import { append, clone, raf } from '~/utilities';
import { ondisconnect, remove } from './cleanup';
import marker from '~/utilities/marker';
import html from '~/html';


type ArraySlotOp<T> =
    | { items: T[]; op: 'concat' }
    | { deleteCount: number; items: T[]; op: 'splice'; start: number }
    | { items: T[]; op: 'push' }
    | { items: T[]; op: 'unshift' }
    | { op: 'clear' }
    | { op: 'pop' }
    | { op: 'reverse' }
    | { op: 'shift' }
    | { op: 'sort'; order: number[] };


// #13: Longest Increasing Subsequence (LIS) Algorithm
// Find the longest sequence of items already in correct order
// Only move items NOT in the LIS for minimal DOM operations
function longestIncreasingSubsequence(arr: number[]): number[] {
    let n = arr.length;

    if (n === 0) {
        return [];
    }

    // For small arrays, don't bother with LIS
    if (n < 4) {
        return [0];
    }

    let parent = new Array(n),
        // Stores indices where smallest ending element for LIS length i is found
        dp = [0],
        result: number[] = [];

    for (let i = 1; i < n; i++) {
        let val = arr[i],
            left = 0,
            right = dp.length - 1;

        // Binary search for position
        while (left <= right) {
            let mid = (left + right) >> 1;

            if (arr[dp[mid]] < val) {
                left = mid + 1;
            }
            else {
                right = mid - 1;
            }
        }

        if (left === dp.length) {
            dp.push(i);
        }
        else {
            dp[left] = i;
        }

        parent[i] = left > 0 ? dp[left - 1] : -1;
    }

    // Reconstruct LIS
    let idx = dp[dp.length - 1];

    for (let i = dp.length - 1; i >= 0; i--) {
        result[i] = idx;
        idx = parent[idx];
    }

    return result;
}


class ArraySlot<T> {
    private queue: ArraySlotOp<T>[] = [];
    private marker: Element;
    private nodes: SlotGroup[] = [];
    private scheduled: boolean = false;
    private signal;
    private template: (...args: Parameters<(value: T) => ReturnType<typeof html>>) => SlotGroup;

    readonly fragment: Node;


    constructor(private array: ReactiveArray<T>, template: ((value: T) => ReturnType<typeof html>)) {
        let fragment = this.fragment = clone(EMPTY_FRAGMENT);

        this.marker = marker.cloneNode() as unknown as Element;
        this.signal = signal(array.length);
        this.template = function (data) {
            let dispose: VoidFunction,
                frag = root((d) => {
                    dispose = d;
                    return template(data);
                }),
                group = {
                    head: frag.firstChild as unknown as Element,
                    tail: frag.lastChild as unknown as Element
                };

            append.call(fragment, frag);
            ondisconnect(group.head, dispose!);

            return group;
        };

        append.call(fragment, this.marker);

        if (array.length) {
            root(() => {
                this.nodes = array.map(this.template);
            });
        }

        array.on('clear', () => {
            this.queue.length = 0;
            this.schedule({ op: 'clear' });
        });
        array.on('concat', ({ items }) => {
            this.schedule({ items, op: 'concat' });
        });
        array.on('pop', () => {
            this.schedule({ op: 'pop' });
        });
        array.on('push', ({ items }) => {
            this.schedule({ items, op: 'push' });
        });
        array.on('reverse', () => {
            this.schedule({ op: 'reverse' });
        });
        array.on('shift', () => {
            this.schedule({ op: 'shift' });
        });
        array.on('sort', ({ order }) => {
            this.schedule({ op: 'sort', order });
        });
        array.on('splice', ({ deleteCount, items, start }) => {
            this.schedule({ deleteCount, items, op: 'splice', start });
        });
        array.on('unshift', ({ items }) => {
            this.schedule({ items, op: 'unshift' });
        });
    }


    private anchor(index: number = this.nodes.length - 1) {
        let node = this.nodes[index];

        if (node) {
            return node.tail || node.head;
        }

        return this.marker;
    }

    private clear() {
        remove(...this.nodes.splice(0));
    }

    private pop() {
        let group = this.nodes.pop();

        if (group) {
            remove(group);
        }
    }

    private push(items: T[]) {
        let anchor = this.anchor();

        this.nodes.push( ...items.map(this.template) );

        anchor.after(this.fragment);
    }

    private schedule(op: ArraySlotOp<T>) {
        this.queue.push(op);

        if (this.scheduled) {
            return;
        }

        this.scheduled = true;

        raf(() => {
            let queue = this.queue;

            this.queue.length = 0;

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

            set(this.signal, this.nodes.length);
            this.scheduled = false;
        });
    }

    private shift() {
        let group = this.nodes.shift();

        if (group) {
            remove(group);
        }
    }

    // #13: LIS-based sort for minimal DOM moves
    // #19: Small array fast path
    private sort(order: number[]) {
        let nodes = this.nodes,
            n = nodes.length;

        if (n !== order.length) {
            remove(...nodes.splice(0));

            this.nodes = this.array.map(this.template);
            this.marker.after(this.fragment);
            return;
        }

        // #19: Small array fast path - for arrays < 4 items, just rebuild
        if (n < 4) {
            let sorted = new Array(n) as SlotGroup[];

            for (let i = 0; i < n; i++) {
                sorted[i] = nodes[order[i]];
            }

            this.nodes = sorted;
            this.sync();
            return;
        }

        // #13: Use LIS to find items already in correct relative order
        // Only move items NOT in the LIS
        let lis = longestIncreasingSubsequence(order),
            lisSet = new Set(lis.map(i => order[i])),
            sorted = new Array(n) as SlotGroup[],
            toMove: { idx: number; group: SlotGroup }[] = [];

        // Build new sorted array and identify items to move
        for (let i = 0; i < n; i++) {
            let originalIdx = order[i],
                group = nodes[originalIdx];

            sorted[i] = group;

            if (!lisSet.has(originalIdx)) {
                toMove.push({ idx: i, group });
            }
        }

        this.nodes = sorted;

        // If most items need moving, just sync all
        if (toMove.length > n / 2) {
            this.sync();
            return;
        }

        // Move only the items not in LIS
        for (let i = 0, moveN = toMove.length; i < moveN; i++) {
            let { idx, group } = toMove[i],
                anchor = idx === 0 ? this.marker : sorted[idx - 1].tail || sorted[idx - 1].head,
                next: Node | null,
                node: Node | null = group.head;

            while (node) {
                next = node === group.tail ? null : node.nextSibling;
                append.call(this.fragment, node);
                node = next;
            }

            anchor.after(this.fragment);
        }
    }

    private splice(start: number, stop: number = this.nodes.length, items: T[]) {
        if (!items.length) {
            remove(...this.nodes.splice(start, stop));
            return;
        }

        remove( ...this.nodes.splice(start, stop, ...items.map(this.template)) );
        this.anchor(start - 1).after(this.fragment);
    }

    private sync() {
        let nodes = this.nodes,
            n = nodes.length;

        if (!n) {
            return;
        }

        for (let i = 0; i < n; i++) {
            let group = nodes[i],
                next: Node | null,
                node: Node | null = group.head;

            while (node) {
                next = node === group.tail ? null : node.nextSibling;

                append.call(this.fragment, node);
                node = next;
            }
        }

        this.marker.after(this.fragment);
    }

    private unshift(items: T[]) {
        this.nodes.unshift(...items.map(this.template));
        this.marker.after(this.fragment);
    }


    get length() {
        return read(this.signal);
    }
}

Object.defineProperty(ArraySlot.prototype, ARRAY_SLOT, { value: true });


export { ArraySlot };
