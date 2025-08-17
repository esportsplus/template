import queue from '@esportsplus/queue';
import { CLEANUP } from '~/constants';
import { microtask } from '~/utilities/queue';
import { previousSibling } from '~/utilities/node';
import { SlotGroup } from '~/types';


let cleanup = queue<VoidFunction[]>(64),
    scheduled = false;


function schedule() {
    if (!cleanup.length || scheduled) {
        return;
    }

    scheduled = true;
    microtask.add(task);
}

function task() {
    try {
        let fns, fn,
            n = cleanup.length;

        while ((fns = cleanup.next()) && n--) {
            while (fn = fns.pop()) {
                fn();
            }
        }
    }
    catch { }

    if (cleanup.length) {
        microtask.add(task);
    }
    else {
        scheduled = false;
    }
}


const ondisconnect = (element: Element, fn: VoidFunction) => {
    ((element as any)[CLEANUP] ??= []).push(fn);
};

const remove = (groups: SlotGroup[]) => {
    let group, head, tail;

    while (group = groups.pop()) {
        head = group.head;
        tail = group.tail || head;

        for (let node = tail; node; node = previousSibling.call(node)) {
            if (CLEANUP in node) {
                cleanup.add( node[CLEANUP] as VoidFunction[] );
            }

            node.remove();

            if (head === node) {
                break;
            }
        }
    }

    if (!scheduled && cleanup.length) {
        schedule();
    }
};


export { ondisconnect, remove };