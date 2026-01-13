import { Attributes, Element } from '../types';
import { raf } from '../utilities';


let tasks = Object.assign(new Set<VoidFunction>(), { running: false });


function tick() {
    if (tasks.size === 0) {
        tasks.running = false;
        return;
    }

    for (let task of tasks) {
        task();
    }

    raf(tick);
}


const add = (task: VoidFunction) => {
    tasks.add(task);

    if (!tasks.running) {
        tasks.running = true;
        raf(tick);
    }
};

const remove = (task: VoidFunction) => {
    tasks.delete(task);
};


export default (element: Element, listener: NonNullable<Attributes['ontick']>) => {
    let connected = false,
        fn = () => {
            if (connected === false) {
                if (element.isConnected) {
                    connected = true;
                }
                else if (retry--) {
                    return;
                }
            }

            if (!element.isConnected) {
                remove(fn);
                return;
            }

            listener(() => remove(fn), element);
        },
        retry = 60;

    add(fn);
};
export { add, remove };
