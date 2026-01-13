import { onCleanup } from '@esportsplus/reactivity';
import { Attributes, Element } from '../types';


let listeners = new Map<Element, Function>(),
    registered = false;


function onresize() {
    for (let [element, fn] of listeners) {
        if (element.isConnected) {
            fn(element);
        }
        else {
            listeners.delete(element);
        }
    }

    if (listeners.size === 0) {
        window.removeEventListener('resize', onresize);
        registered = false;
    }
}


export default (element: Element, listener: NonNullable<Attributes['onresize']>) => {
    listeners.set(element, listener);

    onCleanup(() => {
        listeners.delete(element);
    });

    if (!registered) {
        window.addEventListener('resize', onresize);
        registered = true;
    }
};
