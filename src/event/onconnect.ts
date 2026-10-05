import { root } from '@esportsplus/reactivity';
import { ondisconnect } from '../slot/cleanup';
import { Attributes, Element } from '../types';
import { add, remove } from './ontick';


// The listener runs untracked, in a root released along with the element, so what it creates dies with it
export default (element: Element, listener: NonNullable<Attributes['onconnect']>) => {
    let fn = () => {
            retry--;

            if (element.isConnected) {
                retry = 0;
                root((dispose) => {
                    release = dispose;
                    listener(element);
                });
            }

            if (!retry) {
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
