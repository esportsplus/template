import { Template } from './types';
import slot, { Slot } from './slot';
import render from './render';


class Component {
    slot: Slot;


    constructor(slot: Slot) {
        this.slot = slot;
    }


    render(data: Template) {
        render(data, this.slot);
        return this;
    }
}


export default (element: HTMLElement) => {
    let instance = slot();

    element.prepend( instance.slot );

    return new Component(instance);
};