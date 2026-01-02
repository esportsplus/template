import { STATE_HYDRATING, STATE_NONE } from '~/constants';
import { raf } from '~/utilities';


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


export default (element: Element, listener: Function) => {
    let fn = () => {
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

            listener(() => remove(fn), element);
        },
        retry = 60,
        state = STATE_HYDRATING;

    add(fn);
};
export { add, remove };
