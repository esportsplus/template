import { CLEANUP, PACKAGE_NAME } from '../constants';
import { Element, SlotGroup } from '../types';


function drain(calls: VoidFunction[]): unknown[] {
    let errors: unknown[] = [];

    for (let i = 0, n = calls.length; i < n; i++) {
        try {
            calls[i]();
        }
        catch (e) {
            errors.push(e);
        }
    }

    return errors;
}

function snapshot(node: Node, calls: VoidFunction[]) {
    let fns = (node as any)[CLEANUP] as VoidFunction[] | undefined;

    if (fns !== undefined) {
        while (fns.length) {
            calls.push(fns.pop()!);
        }
    }
}

function collect(node: Node, calls: VoidFunction[]) {
    let walker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT
        ),
        child = walker.firstChild();

    while (child) {
        snapshot(child, calls);
        child = walker.nextNode();
    }

    snapshot(node, calls);
}

function walk(groups: SlotGroup[], detach: boolean) {
    let calls: VoidFunction[] = [],
        removals: ChildNode[] = [];

    for (let i = 0, n = groups.length; i < n; i++) {
        let group = groups[i],
            head = group.head,
            tail = group.tail || head,
            nodes: Node[] = [],
            node: Node | null = tail as Node | null;

        while (node) {
            nodes.push(node);

            if (node === head) {
                break;
            }

            node = node.previousSibling;
        }

        for (let j = 0, o = nodes.length; j < o; j++) {
            collect(nodes[j], calls);
        }

        if (detach) {
            for (let j = 0, o = nodes.length; j < o; j++) {
                removals.push(nodes[j] as ChildNode);
            }
        }
    }

    let errors = drain(calls);

    if (detach) {
        for (let i = 0, n = removals.length; i < n; i++) {
            removals[i].remove();
        }
    }

    if (errors.length) {
        throw errors.length === 1
            ? errors[0]
            : new AggregateError(errors, `${PACKAGE_NAME}: cleanup produced multiple errors`);
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
