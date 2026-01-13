import { read, root, signal, write, Reactive } from '@esportsplus/reactivity';
import { ARRAY_SLOT } from '../constants';
import { Element, SlotGroup } from '../types';
import { clone, fragment, marker, raf } from '../utilities';
import { ondisconnect, remove } from './cleanup';
import html from '../html';


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


const EMPTY_FRAGMENT = fragment('');


class ArraySlot<T> {
    private marker: Element;
    private nodes: SlotGroup[] = [];
    private queue: ArraySlotOp<T>[] = [];
    private scheduled = false;
    private signal;
    private template: (...args: Parameters<(value: Reactive<T[]>[number]) => ReturnType<typeof html>>) => SlotGroup;

    readonly fragment: DocumentFragment;


    constructor(private array: Reactive<T[]>, template: ((value: Reactive<T[]>[number]) => ReturnType<typeof html>)) {
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

            fragment.append(frag);
            ondisconnect(group.head, dispose!);

            return group;
        };

        fragment.append(this.marker);

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

        this.nodes.push(...items.map(this.template));
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

            this.queue = [];
            this.scheduled = false;

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

            write(this.signal, this.nodes.length);
        });
    }

    private shift() {
        let group = this.nodes.shift();

        if (group) {
            remove(group);
        }
    }

    private sort(order: number[]) {
        let nodes = this.nodes,
            n = nodes.length;

        if (n !== order.length) {
            remove(...nodes.splice(0));
            this.nodes = this.array.map(this.template);
            this.marker.after(this.fragment);
            return;
        }

        let sorted = new Array(n) as SlotGroup[];

        for (let i = 0; i < n; i++) {
            sorted[i] = nodes[order[i]];
        }

        this.nodes = sorted;
        this.sync();
    }

    private splice(start: number, stop: number = this.nodes.length, items: T[]) {
        if (!items.length) {
            remove(...this.nodes.splice(start, stop));
            return;
        }

        remove(...this.nodes.splice(start, stop, ...items.map(this.template)));
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
                this.fragment.append(node);
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
