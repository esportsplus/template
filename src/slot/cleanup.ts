import { CLEANUP } from '../constants';
import { Element, SlotGroup } from '../types';


const DESCENDANTS = Symbol(),
    MARKER = 'data-template-cleanup';


function cleanup(node: Element) {
    let fn, fns;

    if (node.nodeType === 1 && node.firstElementChild !== null && (node as any)[DESCENDANTS]) {
        let marked = node.querySelectorAll('[' + MARKER + ']');

        for (let i = 0, n = marked.length; i < n; i++) {
            if (fns = (marked[i] as unknown as Element)[CLEANUP] as VoidFunction[] | undefined) {
                while (fn = fns.pop()) {
                    fn();
                }
            }
        }
    }

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
    let parent = element.parentNode;

    if (element.nodeType === 1 && !element.hasAttribute(MARKER)) {
        element.setAttribute(MARKER, '');
    }

    while (parent) {
        if (parent.nodeType === 1) {
            (parent as any)[DESCENDANTS] = true;
        }

        parent = parent.parentNode;
    }

    ((element as any)[CLEANUP] ??= []).push(fn);
};

const remove = (groups: SlotGroup[]) => {
    walk(groups, true);
};


export { dispose, ondisconnect, remove };
