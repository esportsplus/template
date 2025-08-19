import { root } from '@esportsplus/reactivity';
import { add, remove } from './ontick';


export default (element: Element, listener: Function) => {
    let fn = () => {
            retry--;

            if (element.isConnected) {
                retry = 0;
                root(() => listener(element));
            }

            if (retry) {
                remove(fn);
            }
        },
        retry = 60;

    add(fn);
};