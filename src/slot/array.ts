import { root, ReactiveArray } from '@esportsplus/reactivity';
import { EMPTY_FRAGMENT } from '~/constants';
import { RenderableReactive, SlotGroup } from '~/types';
import { append } from '~/utilities/fragment';
import { cloneNode, firstChild, lastChild } from '~/utilities/node';
import { ondisconnect, remove } from './cleanup';


class ArraySlot<T> {
    array: ReactiveArray<T>;
    fragment: Node;
    marker: Element;
    nodes: SlotGroup[] = [];
    template: (...args: Parameters< RenderableReactive<T>['template'] >) => SlotGroup;


    constructor(anchor: Element, array: ReactiveArray<T>, template: RenderableReactive<T>['template']) {
        let fragment = this.fragment = cloneNode.call(EMPTY_FRAGMENT);

        this.array = array;
        this.marker = anchor;
        this.template = function (data, i) {
            let dispose: VoidFunction,
                frag = root((d) => {
                    dispose = d;
                    return template(data, i);
                }),
                group = {
                    head: firstChild.call(frag),
                    tail: lastChild.call(frag)
                };

            append.call(fragment, frag);
            ondisconnect(group.head, dispose!);

            return group;
        };

        array.on('clear', () => this.clear());
        array.on('reverse', () => {
            root(() => this.render());
        });
        array.on('pop', () => this.pop());
        array.on('push', ({ items }) => {
            root(() => this.push(items));
        });
        array.on('shift', () => this.shift());
        array.on('sort', () => {
            root(() => this.render());
        });
        array.on('splice', ({ deleteCount, items, start }) => {
            root(() => this.splice(start, deleteCount, ...items));
        });
        array.on('unshift', ({ items }) => {
            root(() => this.unshift(items));
        });
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
        remove(...this.nodes.splice(0));
    }

    pop() {
        let group = this.nodes.pop();

        if (group) {
            remove(group);
        }
    }

    push(items: T[]) {
        let anchor = this.anchor();

        this.nodes.push( ...items.map(this.template) );

        anchor.after(this.fragment);
    }

    render() {
        if (this.nodes.length) {
            remove(...this.nodes.splice(0));
        }

        this.nodes = this.array.map(this.template);
        this.marker.after(this.fragment);
    }

    shift() {
        let group = this.nodes.shift();

        if (group) {
            remove(group);
        }
    }

    splice(start: number, stop: number = this.nodes.length, ...items: T[]) {
        if (!items.length) {
            return remove(...this.nodes.splice(start, stop));
        }

        remove( ...this.nodes.splice(start, stop, ...items.map(this.template)) );
        this.anchor(start - 1).after(this.fragment);
    }

    unshift(items: T[]) {
        this.nodes.unshift(...items.map(this.template));
        this.marker.after(this.fragment);
    }
}


export default <T>(anchor: Element, renderable: RenderableReactive<T>) => {
    let array = renderable.array,
        slot = new ArraySlot(anchor, array, renderable.template);

    if (array.length) {
        root(() => {
            slot.nodes = array.map(slot.template);
        });
    }

    return slot.fragment;
};