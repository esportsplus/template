import renderable from './renderable';
import slot from './slot';


function Component(element, raf, task = raf) {
    if (!element) {
        throw new Error('Component cannot be rendererd: DOM element does not exist!');
    }

    element.prepend( document.createComment('slot') );

    this.component = slot(element.firstChild);
    this.raf = raf;
    this.task = task;
}

Component.prototype = {
    render: function(obj) {
        this.task.add(() => {
            let offscreen = renderable(obj).render(slot(), obj.values);

            this.raf.add(() => this.component.render(offscreen));
        });

        return this;
    }
};


export default (element, raf, task) => new Component(element, raf, task);
export { Component };
