import { root } from '@esportsplus/reactivity';
import { ondisconnect } from '../slot';
import { Attributes, Element } from '../types';
import { add, remove } from './ontick';


// Ticks run just before each frame paints: the tick that first finds the element connected is in the frame that
// paints it, so the next one comes after that paint.
export default (element: Element, listener: NonNullable<Attributes['onfirstpaint']>) => {
    let connected = false,
        fn = () => {
            if (connected) {
                remove(fn);
                root(() => listener(element));
                return;
            }

            if (element.isConnected) {
                connected = true;
            }
            else if (!--retry) {
                remove(fn);
            }
        },
        retry = 60;

    add(fn);
    ondisconnect(element, () => remove(fn));
};
