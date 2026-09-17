import { root } from '@esportsplus/reactivity';
import { CLEANUP } from './constants';
import render from './slot/render';
import { clone, EMPTY_FRAGMENT } from './utilities';


type Entry = {
    current: Function | null;
    exportId: string;
    fragment: DocumentFragment | null;
    instances: Set<Instance>;
    kind: 'callable' | 'eager' | 'factory';
    moduleId: string;
    pending: Function | null;
    wrapper: Function | null;
};

type Instance = {
    dispose: VoidFunction | null;
    end: Comment;
    invocation: Invocation;
    start: Comment;
    status: 'idle' | 'mounted' | 'replacing';
};

type Invocation = {
    args: unknown[];
    thisArg: unknown;
};


let entries = new Map<string, Entry>(),
    pendingExports = new Map<string, Set<string>>();


const key = (moduleId: string, exportId: string): string => moduleId + '\u0000' + exportId;


function drain(calls: VoidFunction[]): void {
    for (let i = 0, n = calls.length; i < n; i++) {
        calls[i]();
    }
}

function snapshot(node: Node, calls: VoidFunction[]): void {
    let fns = (node as any)[CLEANUP] as VoidFunction[] | undefined;

    if (fns !== undefined) {
        while (fns.length) {
            calls.push(fns.pop()!);
        }
    }
}

// Stage-1 cleanup traversal: drain every cleanup registered on comment/text/element anchors
// between the start and end comments, then detach the owned nodes while keeping the anchors.
function clearRange(start: Comment, end: Comment): void {
    let calls: VoidFunction[] = [],
        parent = start.parentNode;

    if (parent) {
        let walker = document.createTreeWalker(
                parent,
                NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT
            );

        walker.currentNode = start;

        for (let node = walker.nextNode(); node !== null && node !== end; node = walker.nextNode()) {
            snapshot(node, calls);
        }
    }

    drain(calls);

    let node: ChildNode | null = start.nextSibling;

    while (node !== null && node !== end) {
        let next = node.nextSibling;

        node.remove();
        node = next;
    }
}

function entryFor(moduleId: string, exportId: string, kind: Entry['kind']): Entry {
    let k = key(moduleId, exportId),
        entry = entries.get(k);

    if (entry) {
        return entry;
    }

    entry = {
        current: null,
        exportId,
        fragment: null,
        instances: new Set(),
        kind,
        moduleId,
        pending: null,
        wrapper: null
    };

    entries.set(k, entry);

    return entry;
}

function track(moduleId: string, exportId: string): void {
    let set = pendingExports.get(moduleId);

    if (set === undefined) {
        set = new Set();
        pendingExports.set(moduleId, set);
    }

    set.add(exportId);
}

function build(entry: Entry, invocation: Invocation, impl: Function): DocumentFragment {
    let fragment = clone(EMPTY_FRAGMENT),
        start = document.createComment('hmr'),
        end = document.createComment('hmr'),
        dispose: VoidFunction | null = null,
        content = root((disposer) => {
            dispose = disposer;
            return Reflect.apply(impl, invocation.thisArg, invocation.args);
        });

    fragment.append(start, render(content), end);

    entry.instances.add({
        dispose,
        end,
        invocation,
        start,
        status: 'mounted'
    });

    return fragment;
}

function forward(source: Function, target: Function): void {
    for (let own of Reflect.ownKeys(source)) {
        if (own === 'length' || own === 'name' || own === 'prototype' || own === 'arguments' || own === 'caller') {
            continue;
        }

        let descriptor = Object.getOwnPropertyDescriptor(source, own);

        if (descriptor !== undefined && descriptor.configurable !== false) {
            try {
                Object.defineProperty(target, own, descriptor);
            }
            catch {
                // Non-configurable or otherwise unforwardable properties are ignored.
            }
        }
    }
}

function setLength(target: Function, source: Function): void {
    try {
        Object.defineProperty(target, 'length', {
            configurable: true,
            value: source.length
        });
    }
    catch {
        // Some environments make function length read-only; arity preservation is best-effort.
    }
}

function setName(target: Function, source: Function): void {
    try {
        Object.defineProperty(target, 'name', {
            configurable: true,
            value: source.name
        });
    }
    catch {
        // Best-effort only.
    }
}

function wrapperFor(entry: Entry, impl: Function, tracked: boolean): Function {
    if (tracked) {
        let wrapper = function (this: unknown, ...args: unknown[]) {
            let current = entry!.current ?? entry!.pending;

            if (current === null) {
                throw new Error('@esportsplus/template: hmr factory invoked while its module is being replaced');
            }

            return build(entry!, { args, thisArg: this }, current);
        };

        setLength(wrapper, impl);
        setName(wrapper, impl);
        forward(impl, wrapper);

        return wrapper;
    }

    let wrapper = function (this: unknown, ...args: unknown[]) {
        let current = entry!.current ?? entry!.pending;

        if (current === null) {
            throw new Error('@esportsplus/template: hmr callable invoked while its module is being replaced');
        }

        return Reflect.apply(current, this, args);
    };

    setLength(wrapper, impl);
    setName(wrapper, impl);
    forward(impl, wrapper);

    return wrapper;
}

function remount(entry: Entry): void {
    let impl = entry.pending!;

    entry.pending = null;

    for (let instance of entry.instances) {
        instance.status = 'replacing';
        clearRange(instance.start, instance.end);
        instance.dispose?.();
        instance.dispose = null;
    }

    for (let instance of entry.instances) {
        let fragment = clone(EMPTY_FRAGMENT),
            dispose: VoidFunction | null = null,
            content = root((disposer) => {
                dispose = disposer;
                return Reflect.apply(impl, instance.invocation.thisArg, instance.invocation.args);
            });

        fragment.append(render(content));
        instance.end.parentNode?.insertBefore(fragment, instance.end);
        instance.dispose = dispose;
        instance.status = 'mounted';
    }

    entry.current = impl;
}

function teardown(instance: Instance, removeAnchors: boolean): void {
    clearRange(instance.start, instance.end);
    instance.dispose?.();
    instance.dispose = null;
    instance.status = 'idle';

    if (removeAnchors) {
        instance.start.remove();
        instance.end.remove();
    }
}


const accept = (moduleId: string): boolean => {
    let pending = pendingExports.get(moduleId);

    if (pending === undefined || pending.size === 0) {
        return false;
    }

    let live = new Set<string>();

    for (let entry of entries.values()) {
        if (entry.moduleId === moduleId) {
            live.add(entry.exportId);
        }
    }

    if (pending.size !== live.size) {
        return false;
    }

    for (let exportId of pending) {
        if (!live.has(exportId)) {
            return false;
        }
    }

    for (let entry of entries.values()) {
        if (entry.moduleId !== moduleId || entry.pending === null) {
            continue;
        }

        if (entry.kind === 'callable') {
            entry.current = entry.pending;
            entry.pending = null;
        }
        else {
            remount(entry);
        }
    }

    pendingExports.delete(moduleId);

    return true;
};

const callable = (moduleId: string, exportId: string, getImpl: () => Function): Function => {
    let entry = entryFor(moduleId, exportId, 'callable'),
        impl = getImpl();

    track(moduleId, exportId);

    if (entry.wrapper === null) {
        entry.current = impl;
        entry.wrapper = wrapperFor(entry, impl, false);
    }
    else {
        entry.pending = impl;
        setLength(entry.wrapper, impl);
        setName(entry.wrapper, impl);
        forward(impl, entry.wrapper);
    }

    return entry.wrapper;
};

const dispose = (moduleId: string): void => {
    pendingExports.set(moduleId, new Set());

    for (let entry of entries.values()) {
        if (entry.moduleId === moduleId) {
            entry.current = null;
        }
    }
};

const eager = (moduleId: string, exportId: string, builder: () => unknown): DocumentFragment => {
    let entry = entryFor(moduleId, exportId, 'eager');

    track(moduleId, exportId);

    if (entry.fragment === null) {
        entry.current = builder;
        entry.fragment = build(entry, { args: [], thisArg: undefined }, builder);
    }
    else {
        entry.pending = builder;
    }

    return entry.fragment;
};

const factory = (moduleId: string, exportId: string, getImpl: () => Function): Function => {
    let entry = entryFor(moduleId, exportId, 'factory'),
        impl = getImpl();

    track(moduleId, exportId);

    if (entry.wrapper === null) {
        entry.current = impl;
        entry.wrapper = wrapperFor(entry, impl, true);
    }
    else {
        entry.pending = impl;
        setLength(entry.wrapper, impl);
        setName(entry.wrapper, impl);
        forward(impl, entry.wrapper);
    }

    return entry.wrapper;
};

const prune = (moduleId: string): void => {
    for (let entry of [...entries.values()]) {
        if (entry.moduleId !== moduleId) {
            continue;
        }

        for (let instance of entry.instances) {
            teardown(instance, true);
        }

        entry.instances.clear();
        entry.current = null;
        entry.pending = null;
        entry.fragment = null;
        entry.wrapper = null;
        entries.delete(key(entry.moduleId, entry.exportId));
    }

    pendingExports.delete(moduleId);
};

const revision = (moduleId: string): object => ({ moduleId });


export { accept, callable, dispose, eager, factory, prune, revision };
