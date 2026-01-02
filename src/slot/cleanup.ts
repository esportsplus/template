import { CLEANUP } from '~/constants';
import { Element, SlotGroup } from '~/types';


// #17: Start/End Boundary Tracking
// Track boundaries explicitly for O(1) range operations
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
            fns = tail[CLEANUP] as VoidFunction[] | undefined;

            if (fns !== undefined) {
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
