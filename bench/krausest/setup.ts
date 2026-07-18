// Must be evaluated BEFORE '@esportsplus/reactivity' and 'src/utilities' — both capture the schedulers at module load
let microtasks: VoidFunction[] = [],
    rafs: FrameRequestCallback[] = [];


globalThis.queueMicrotask = (callback: VoidFunction) => {
    microtasks.push(callback);
};

globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    rafs.push(callback);
    return rafs.length;
}) as typeof requestAnimationFrame;


// Drains scheduler queues synchronously so samples measure CPU cost, not frame latency
const flush = () => {
    for (let guard = 0; guard < 10000; guard++) {
        if (microtasks.length) {
            let queue = microtasks;

            microtasks = [];

            for (let i = 0, n = queue.length; i < n; i++) {
                queue[i]();
            }

            continue;
        }

        if (rafs.length) {
            let queue = rafs;

            rafs = [];

            for (let i = 0, n = queue.length; i < n; i++) {
                queue[i](performance.now());
            }

            continue;
        }

        return;
    }

    throw new Error('Krausest: scheduler queues did not settle!');
};


export { flush };
