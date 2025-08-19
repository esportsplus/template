import { STATE_HYDRATING, STATE_NONE } from '~/constants';
import { raf } from '~/utilities/queue';


let tasks = Object.assign(new Set<VoidFunction>(), { running: false });


function tick() {
    if (tasks.size === 0) {
        tasks.running = false;
        return;
    }

    for (let task of tasks) {
        task();
    }

    raf.add(tick);
}


const add = (task: VoidFunction) => {
    tasks.add(task);

    if (!tasks.running) {
        tasks.running = true;
        raf.add(tick);
    }
};

const remove = (task: VoidFunction) => {
    tasks.delete(task);
};


export default (element: Element, listener: Function) => {
    let dispose = () => {
            remove(fn);
        },
        fn = () => {
            if (state === STATE_HYDRATING) {
                if (element.isConnected) {
                    state = STATE_NONE;
                }
                else if (retry--) {
                    return;
                }
            }

            if (!element.isConnected) {
                remove(fn);
                return;
            }

            listener(dispose, element);
        },
        retry = 60,
        state = STATE_HYDRATING;

    add(fn);
};
export { add, remove };