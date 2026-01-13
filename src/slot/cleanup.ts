import { CLEANUP } from '../constants';
import { Element, SlotGroup } from '../types';


const ondisconnect = (element: Element, fn: VoidFunction) => {
    ((element as any)[CLEANUP] ??= []).push(fn);
};

const remove = (...groups: SlotGroup[]) => {
    for (let i = 0, n = groups.length; i < n; i++) {
        let fns, fn,
            group = groups[i],
            head = group.head,
            next,
            tail = group.tail || head;

        while (tail) {
            if (fns = tail[CLEANUP] as VoidFunction[] | undefined) {
                while (fn = fns.pop()) {
                    fn();
                }
            }

            next = tail.previousSibling as unknown as Element;
            tail.remove();

            if (head === tail) {
                break;
            }

            tail = next;
        }
    }
};


export { ondisconnect, remove };
