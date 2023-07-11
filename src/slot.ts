import { SLOT } from './constants';
import { after, remove, template } from './dom';
import { Node, Nodes } from './types';


let factory = template(SLOT);


class Slot {
    nodes: Nodes[] = [];
    slot: Node;


    constructor(node?: Node | null) {
        this.slot = node || factory()[0];
    }


    after(index: number, nodes: Nodes) {
        this.nodes.splice(index, 0, after(this.anchor(index), nodes));

        return this;
    }

    anchor(index?: number) {
        let node: Node | undefined;

        if (index === undefined) {
            index = this.nodes.length - 1;
        }

        if (index in this.nodes) {
            node = this.nodes[index][ (this.nodes[index].length || 0) - 1 ];
        }

        return node || this.slot;
    }

    clear() {
        for (let i = 0, n = this.nodes.length; i < n; i++) {
            remove(this.nodes[i]);
        }

        this.nodes.length = 0;

        return this;
    }

    pop() {
        remove(this.nodes.pop() || []);

        return this;
    }

    push(nodes: Nodes) {
        this.nodes.push( after(this.anchor(), nodes) );

        return this;
    }

    render(nodes: Nodes[]) {
        this.clear();

        for (let i = 0, n = nodes.length; i < n; i++) {
            after(this.anchor(), nodes[i])
        }

        this.nodes = nodes;

        return this;
    }

    set(index: number, nodes: Nodes) {
        let removing = this.nodes.splice(index, 1, after(this.anchor(index), nodes));

        for (let i = 0, n = removing.length; i < n; i++) {
            remove( removing[i] );
        }

        return this;
    }

    shift() {
        remove(this.nodes.shift() || []);

        return this;
    }

    splice(index: number, total = 1) {
        if (!this.nodes.length) {
            return;
        }

        let removing = this.nodes.splice(index, total);

        for (let i = 0, n = removing.length; i < n; i++) {
            remove(removing[i]);
        }

        return this;
    }

    unshift(nodes: Nodes) {
        this.nodes.unshift( after(this.slot, nodes) );

        return this;
    }
}


export default (...args: ConstructorParameters<typeof Slot>) => new Slot(...args);
export { Slot };