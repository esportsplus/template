import { dispose, ondisconnect } from '../slot';
import { Attributes, Element } from '../types';


let counter = 0,
    listeners = new Map<Element, Function>(),
    registered = false;


function onresize() {
    for (let [element, fn] of listeners) {
        if (element.isConnected) {
            fn(element);
        }
        else {
            counter--;
            listeners.delete(element);
            dispose([{ head: element, tail: element }]);
        }
    }

    if (listeners.size === 0) {
        registered = false;
        window.removeEventListener('resize', onresize);
    }
}


export default (element: Element, listener: NonNullable<Attributes['onresize']>) => {
    counter++;
    listeners.set(element, listener);

    if (!registered) {
        registered = true;
        window.addEventListener('resize', onresize);
    }

    ondisconnect(element, () => {
        counter--;
        listeners.delete(element);

        if (!counter && registered) {
            registered = false;
            window.removeEventListener('resize', onresize);
        }
    });
};
