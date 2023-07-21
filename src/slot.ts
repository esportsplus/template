import { SLOT } from './constants';
import { after, remove, template } from './dom';
import { Node, Nodes } from './types';


let factory = template(SLOT);


class Slot {
    nodes: Nodes[] = [];
    slot: Node;


    constructor(node?: Node | null) {
        this.slot = node == null ? factory()[0] : node;
    }


    get length() {
        return this.nodes.length;
    }

    set length(n: number) {
        this.splice(n);
    }


    anchor(index?: number) {
        let node: Node | undefined;

        if (index === undefined) {
            index = this.nodes.length - 1;
        }

        let nodes = this.nodes[index];

        if (nodes !== undefined) {
            node = nodes[ nodes.length - 1 ];
        }

        return node === undefined ? this.slot : node;
    }

    pop() {
        return remove( this.nodes.pop() );
    }

    push(...groups: Nodes[]) {
        groups = after.groups(this.anchor(), groups);

        for (let i = 0, n = groups.length; i < n; i++) {
            this.nodes.push(groups[i]);
        }

        return this.nodes.length;
    }

    render(groups: Nodes[]) {
        this.splice(0, this.nodes.length, ...after.groups(this.slot, groups));
    }

    shift() {
        return remove( this.nodes.shift() );
    }

    splice(start: number, deleteCount: number = this.nodes.length, ...groups: Nodes[]) {
        return remove.groups(
            this.nodes.splice(start, deleteCount, ...after.groups(this.anchor(start), groups))
        );
    }

    unshift(...groups: Nodes[]) {
        return this.nodes.unshift( ...after.groups(this.slot, groups) );
    }
}


export default (...args: ConstructorParameters<typeof Slot>) => new Slot(...args);
export { Slot };