import { SLOT, SLOT_HTML } from './constants';
import { after, remove } from './dom';
import html from './html';
import renderable from './renderable';


let template = renderable( html.const(SLOT_HTML) );


class Slot {
    #anchor: ChildNode;
    #nodes: (ChildNode[])[] = [];


    constructor(anchor?: ChildNode) {
        this.#anchor = anchor || template.nodes[0];
    }


    get [SLOT]() {
        return true;
    }

    get length() {
        return this.#nodes.length;
    }

    set length(n: number) {
        this.splice(n);
    }


    anchor(index: number = this.#nodes.length - 1) {
        let node,
            nodes = this.#nodes[index];

        if (nodes) {
            node = nodes[ nodes.length - 1 ];
        }

        return node || this.#anchor;
    }

    pop() {
        return remove( this.#nodes.pop() );
    }

    push(...groups: (ChildNode[])[]) {
        after.groups(this.anchor(), groups);

        for (let i = 0, n = groups.length; i < n; i++) {
            this.#nodes.push(groups[i]);
        }

        return this.#nodes.length;
    }

    render(groups: ChildNode[]) {
        remove.groups(this.#nodes);

        this.#nodes = [
            after(this.#anchor, groups)
        ];
    }

    shift() {
        return remove( this.#nodes.shift() );
    }

    splice(start: number, deleteCount: number = this.#nodes.length, ...groups: (ChildNode[])[]) {
        return remove.groups(
            this.#nodes.splice(start, deleteCount, ...after.groups(this.anchor(start), groups))
        );
    }

    unshift(...groups: (ChildNode[])[]) {
        return this.#nodes.unshift( ...after.groups(this.#anchor, groups) );
    }
}


export default (anchor?: ChildNode) => {
    return new Slot(anchor);
};
export { Slot };