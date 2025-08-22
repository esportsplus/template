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
    let group;

    while (group = groups.pop()) {
        let head = group.head,
            next,
            tail = group.tail || head;

        while (tail) {
            if (CLEANUP in tail) {
                cleanup.add( tail[CLEANUP] as VoidFunction[] );
            }

            next = previousSibling.call(tail);
            tail.remove();

            if (head === tail) {
                break;
            }

            tail = next;
        }
    }

    if (!scheduled && cleanup.length) {
        schedule();
    }
};


export { ondisconnect, remove };