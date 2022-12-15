import { task, raf } from '~/app';
import renderable from './renderable';
import slot from './slot';


function Component(element) {
    if (!element) {
        throw new Error('Component cannot be rendererd: DOM element does not exist!');
    }

    element.prepend( document.createComment('slot') );

    this.component = slot(element.firstChild);
}

Component.prototype = {
    render: function(obj) {
        task.add(() => {
            let offscreen = renderable(obj).render(slot(), obj.values);

            raf.add(() => this.component.render(offscreen));
        });

        return this;
    }
};


export default (element) => new Component(element);
export { Component };
