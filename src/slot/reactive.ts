import { root, ReactiveArray } from '@esportsplus/reactivity';
import { EMPTY_FRAGMENT } from '~/constants';
import { Fragment, RenderableReactive, SlotGroup } from '~/types';
import { append, cloneNode, firstChild, lastChild } from '~/utilities';
import { remove } from './cleanup';


class ReactiveArraySlot<T> {
    array: ReactiveArray<T[]>;
    fragment = cloneNode.call(EMPTY_FRAGMENT) as Fragment;
    marker: Element;
    nodes: SlotGroup[] = [];
    template: (
        this: ReactiveArray<T[]>,
        ...args: Parameters< Parameters<ReactiveArray<T[]>['map']>[0] >
    ) => SlotGroup;


    constructor(anchor: Element, array: ReactiveArray<T[]>, template: RenderableReactive['template']) {
        let fragment = this.fragment;

        this.array = array;
        this.marker = anchor;
        this.template = function (data, i) {
            let frag = template.call(this, data, i).fragment,
                group = {
                    head: firstChild.call(frag),
                    tail: lastChild.call(frag)
                };

            append.call(fragment, frag);

            return group;
        };


        let render = () => {
                root(() => this.render());
            };

        array.on('clear', () => this.clear());
        array.on('reverse', render);
        array.on('pop', () => this.pop());
        array.on('push', ({ items }) => {
            root(() => this.push(items));
        });
        array.on('shift', () => this.shift());
        array.on('sort', render);
        array.on('splice', ({ deleteCount, items, start }) => {
            root(() => this.splice(start, deleteCount, ...items));
        });
        array.on('unshift', ({ items }) => {
            root(() => this.unshift(items));
        });

        if (array.length) {
            render();
        }
    }


    get length() {
        return this.nodes.length;
    }

    set length(n: number) {
        if (n >= this.nodes.length) {
            return;
        }
        else if (n === 0) {
            this.clear();
        }
        else {
            this.splice(n);
        }
    }


    anchor(index: number = this.nodes.length - 1) {
        let node = this.nodes[index];

        if (node) {
            return node.tail || node.head;
        }

        return this.marker;
    }

    clear() {
        remove(this.nodes);
    }

    pop() {
        let group = this.nodes.pop();

        if (group) {
            remove([group]);
        }
    }

    push(items: T[]) {
        let anchor = this.anchor(),
            array = this.array;

        for (let i = 0, n = items.length; i < n; i++) {
            this.nodes.push(
                this.template.call(array, items[i], i)
            );
        }

        anchor.after(this.fragment);
    }

    render() {
        let nodes = this.nodes;

        if (nodes.length) {
            remove(nodes);
        }

        nodes = this.array.map(this.template);
        this.marker.after(this.fragment);
    }

    shift() {
        let group = this.nodes.shift();

        if (group) {
            remove([group]);
        }
    }

    splice(start: number, stop: number = this.nodes.length, ...items: T[]) {
        if (!items.length) {
            return remove(this.nodes.splice(start, stop));
        }

        let array = this.array,
            n = items.length,
            nodes = new Array(n);

        for (let i = 0; i < n; i++) {
            nodes[i] = this.template.call(array, items[i], i);
        }

        remove(this.nodes.splice(start, stop, ...nodes));
        this.anchor(start - 1).after(this.fragment);
    }

    unshift(items: T[]) {
        let array = this.array,
            n = items.length,
            nodes = new Array(n);

        for (let i = 0; i < n; i++) {
            nodes[i] = this.template.call(array, items[i], i);
        }

        this.nodes.unshift(...nodes);
        this.marker.after(this.fragment);
    }
}


export default (anchor: Element, renderable: RenderableReactive) => {
    new ReactiveArraySlot(anchor, renderable.array, renderable.template);
};