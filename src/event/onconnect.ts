import { root } from '@esportsplus/reactivity';
import { ondisconnect } from '../slot/cleanup';
import { Element } from '../types';
import { add, remove } from './ontick';


// The listener runs 'frames' ticks after the first that finds the element connected, untracked, in a root released
// along with the element, so what it creates dies with it. An element that never connects is dropped after 60 ticks.
export default (element: Element, listener: (element: Element) => void, frames: number = 0) => {
    let fn = () => {
            if (seen || element.isConnected) {
                if (seen++ < frames) {
                    return;
                }

                remove(fn);
                root((dispose) => {
                    release = dispose;
                    listener(element);
                });
            }
            else if (!--retry) {
                remove(fn);
            }
        },
        release: VoidFunction | null = null,
        retry = 60,
        seen = 0;

    add(fn);
    ondisconnect(element, () => {
        remove(fn);
        release?.();
    });
};
