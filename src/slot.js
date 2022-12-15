import dom from './dom';


let offscreen = dom.template('<!--slot-->');


function Slot(node) {
    this.nodes = [];
    this.slot = node || offscreen()[0];
};

Slot.prototype = {
    anchor: function(index = null) {
        let node;

        if (index === null) {
            index = this.nodes.length - 1;
        }

        if (this.nodes[index]) {
            node = this.nodes[index][(this.nodes[index].length || 0) - 1];
        }

        return node || this.slot;
    },
    after: function(index, nodelist) {
        this.nodes.splice(index, 0, dom.after(this.anchor(index), nodelist));
    },
    delete: function(index, total = 1) {
        if (!this.nodes.length) {
            return;
        }

        let nodelists = this.nodes.splice(index, total);

        for (let i = 0, n = nodelists.length; i < n; i++) {
            dom.remove(nodelists[i]);
        }
    },
    pop: function() {
        dom.remove(this.nodes.pop());
    },
    push: function(nodelist) {
        this.nodes.push(dom.after(this.anchor(), nodelist));
    },
    render: function(template) {
        this.delete(0, this.nodes.length);

        for (let i = 0, n = template.nodes.length; i < n; i++) {
            this.nodes.push( dom.after(this.anchor(), template.nodes[i]) );
        }
    },
    set: function(index, nodelist) {
        dom.remove(
            this.nodes.splice(index, 1, dom.after(this.anchor(index), nodelist))
        );
    },
    shift: function() {
        dom.remove(this.nodes.shift());
    },
    unshift: function(nodelist) {
        this.nodes.unshift(dom.after(this.slot, nodelist));
    }
};


export default (node) => new Slot(node);
