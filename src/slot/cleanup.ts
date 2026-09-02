import { CLEANUP } from '../constants';
import { Element, SlotGroup } from '../types';

function cleanup(node: Element) {
    let fn, fns;

    if (fns = node[CLEANUP] as VoidFunction[] | undefined) {
        while (fn = fns.pop()) {
            fn();
        }
    }
}

function walk(groups: SlotGroup[], detach: boolean) {
    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i],
            head = group.head,
            next,
            tail = group.tail || head;

        while (tail) {
            cleanup(tail);

            next = tail.previousSibling as unknown as Element;

            if (detach) {
                tail.remove();
            }

            if (head === tail) {
                break;
            }

            tail = next;
        }
    }
}


const dispose = (groups: SlotGroup[]) => {
    walk(groups, false);
};

const ondisconnect = (element: Element, fn: VoidFunction) => {
    ((element as any)[CLEANUP] ??= []).push(fn);
};

const remove = (groups: SlotGroup[]) => {
    walk(groups, true);
};


export { dispose, ondisconnect, remove };
