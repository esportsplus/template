import { root } from '@esportsplus/reactivity';
import { ondisconnect } from '../slot/cleanup';
import { Attributes, Element } from '../types';
import { add, remove } from './ontick';


// Ticks run just before each frame paints: the tick that first finds the element connected is in the frame that
// paints it, so the next one comes after that paint. The listener runs untracked, in a root released along with the
// element, so what it creates dies with it.
export default (element: Element, listener: NonNullable<Attributes['onfirstpaint']>) => {
    let connected = false,
        fn = () => {
            if (connected) {
                remove(fn);
                root((dispose) => {
                    release = dispose;
                    listener(element);
                });
                return;
            }

            if (element.isConnected) {
                connected = true;
            }
            else if (!--retry) {
                remove(fn);
            }
        },
        release: VoidFunction | null = null,
        retry = 60;

    add(fn);
    ondisconnect(element, () => {
        remove(fn);
        release?.();
    });
};
