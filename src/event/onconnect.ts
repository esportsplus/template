import { root } from '@esportsplus/reactivity';
import { Attributes, Element } from '../types';
import { add, remove } from './ontick';


export default (element: Element, listener: NonNullable<Attributes['onconnect']>) => {
    let fn = () => {
            retry--;

            if (element.isConnected) {
                retry = 0;
                root(() => listener(element));
            }

            if (!retry) {
                remove(fn);
            }
        },
        retry = 60;

    add(fn);
};
