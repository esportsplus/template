import { defineProperty } from '@esportsplus/utilities';
import { DIRECT_ATTACH_EVENTS, PACKAGE_NAME, PASSIVE_EVENTS } from '../constants';
import { context, heal, MOUNTED, ondisconnect as disconnect } from '../slot/cleanup';
import type { Slot } from '../slot/cleanup';
import { Attributes, Element, EventOptions, On } from '../types';
import connect from './onconnect';
import onfirstpaint from './onfirstpaint';
import ontick from './ontick';
import parse from './parse';
import type { Route } from './parse';


// Delegated bindings chain on their element under the registration's key; the rest chain on the registration
type Binding = { flags: number; listener: Function | undefined; next: Binding | null; release: VoidFunction };

// A slot of its own so a dispatch that finds its element removed can heal what owned it
type Guarded = Binding & Slot & { anchor: Element };

// Typed per key, so a handler written in a template or an inline attribute object takes its event's type
type Keyed<P extends string> = <E extends string>(element: Element, event: E, listener: Attributes[`${P}${E}`], options?: Once) => void;

type Member = Binding & {
    anchor: Element | null;
    disposed: boolean;
    next: Member | null;
    parent: Slot | null;
    prev: Member | null;
    self: unknown;
    state: number;
};

type Once = Pick<EventOptions, 'once'>;

type Records = Record<string, Registration | undefined>;

// One native listener per target, event, capture and passive
type Registration = {
    count: number;
    delegated: number;
    head: Member | null;
    key: symbol;
    release: VoidFunction;
    // Holds an attribute key's binding on its element, so a later one replaces it
    slot: symbol;
    tail: Member | null;
};


// Bound by an attribute key: one per element and event, a later one replaces the earlier
const ATTRIBUTE = 1;

// Not run while its element is out of the document
const GUARDED = 2;

const ONCE = 4;

const OPTIONS_ONCE: Once = { once: true };


// The document's registrations, which hosts also maps it to: attribute keys read the bubbling default by bare event
let documents: Records = {},
    hosts = new WeakMap<EventTarget, Records>(),
    noop = () => {},
    passives = new Set<string>(PASSIVE_EVENTS);


function attribute(options: Once | undefined) {
    return options?.once ? ATTRIBUTE | ONCE : ATTRIBUTE;
}

function bind(
    target: EventTarget,
    event: string,
    listener: Function,
    options: EventOptions | undefined,
    flags: number,
    owner: Element | null,
    parent: Slot | null
): VoidFunction {
    let capture = false,
        direct = false,
        passive: boolean | undefined,
        signal: AbortSignal | undefined;

    if (options !== undefined) {
        signal = options.signal;

        if (signal?.aborted) {
            return noop;
        }

        capture = options.capture === true;
        direct = options.direct === true;
        passive = options.passive;

        if (options.once) {
            flags |= ONCE;
        }
    }

    // Delegated capture never exists, so the template never has to order it against bubbling listeners
    if (!capture && !direct && (target as Node).nodeType === 1 && !DIRECT_ATTACH_EVENTS.has(event)) {
        return chain(registration(document, event, false, passive), target as Element, listener, flags, owner, parent, signal);
    }

    return subscribe(registration(target, event, capture, passive), target, listener, flags, owner, parent, signal);
}

function chain(
    registration: Registration,
    node: Element,
    listener: Function,
    flags: number,
    owner: Element | null,
    parent: Slot | null,
    signal: AbortSignal | undefined
): VoidFunction {
    // Every binding allocates this closure: it reads what it can back from the binding and registration rather than
    // capture more
    let head = node[registration.key] as Binding | null | undefined,
        release = () => {
            if (binding.listener === undefined) {
                return;
            }

            binding.listener = undefined;

            let key = registration.key,
                current = node[key] as Binding;

            // A released binding keeps its next, so a dispatch standing on it carries on
            if (current === binding) {
                node[key] = binding.next;
            }
            else {
                while (current.next !== binding) {
                    current = current.next!;
                }

                current.next = binding.next;
            }

            if (binding.flags & GUARDED) {
                (binding as Guarded).disposed = true;
            }

            signal?.removeEventListener('abort', release);
            registration.delegated--;
            registration.release();
        },
        binding: Binding = flags & GUARDED
            ? { anchor: owner, disposed: false, flags, listener, next: null, parent, release, state: 0 } as Guarded
            : { flags, listener, next: null, release };

    registration.count++;
    registration.delegated++;

    if (head) {
        let previous: Binding | null = null;

        while (true) {
            if (flags & head.flags & ATTRIBUTE) {
                previous = head;
            }

            if (head.next === null) {
                break;
            }

            head = head.next;
        }

        head.next = binding;
        previous?.release();
    }
    else {
        node[registration.key] = binding;
    }

    if (owner !== null) {
        disconnect(owner, release);
    }

    signal?.addEventListener('abort', release);

    return release;
}

// Out of the document the element is not run; once seen in it, being out means foreign code removed it.
// Delegated attribute bindings need no such check: a detached target's event never reaches the document.
function connected(binding: Guarded) {
    if (binding.anchor.isConnected) {
        binding.state |= MOUNTED;
        return true;
    }

    if (binding.state & MOUNTED) {
        heal(binding);
    }

    return false;
}

function dispatch(registration: Registration) {
    return (e: Event) => {
        let errors: unknown[] | null = null;

        if (registration.delegated) {
            let key = registration.key,
                node = e.target as Element | null;

            while (node) {
                let binding = node[key] as Binding | null | undefined;

                if (binding) {
                    defineProperty(e, 'currentTarget', {
                        configurable: true,
                        value: node
                    });

                    errors = run(binding, e, node, errors);

                    // Later listeners must see the native currentTarget
                    delete (e as unknown as Record<string, unknown>).currentTarget;
                    break;
                }

                node = node.parentElement as Element | null;
            }
        }

        if (registration.head !== null) {
            errors = run(registration.head, e, null, errors);
        }

        if (errors) {
            throw errors.length === 1
                ? errors[0]
                : new AggregateError(errors, `${PACKAGE_NAME}: event handlers produced multiple errors`);
        }
    };
}

function register(records: Records, name: string, target: EventTarget, event: string, capture: boolean, passive: boolean): Registration {
    let registration: Registration = {
            count: 0,
            delegated: 0,
            head: null,
            key: Symbol(),
            release: () => {
                if (--registration.count) {
                    return;
                }

                target.removeEventListener(event, handler, capture);
                records[name] = undefined;
            },
            slot: Symbol(),
            tail: null
        },
        handler = dispatch(registration);

    target.addEventListener(event, handler, { capture, passive });

    return records[name] = registration;
}

// 'passive' left undefined takes the event's default, which shares the registration of an explicit default
function registration(target: EventTarget, event: string, capture: boolean, passive: boolean | undefined): Registration {
    let records = hosts.get(target);

    if (records === undefined) {
        hosts.set(target, records = target === globalThis.document ? documents : {});
    }

    if (passive !== undefined && passive === passives.has(event)) {
        passive = undefined;
    }

    let name = capture || passive !== undefined
            ? `${event} ${capture ? 1 : 0}${passive ? 1 : 0}`
            : event;

    return records[name] ?? register(records, name, target, event, capture, passive ?? passives.has(event));
}

// Live iteration: a binding released mid-dispatch is skipped, one added after the current one runs
function run(binding: Binding | null, e: Event, node: Element | null, errors: unknown[] | null) {
    while (binding !== null) {
        let flags = binding.flags,
            listener = binding.listener;

        if (listener !== undefined && (!(flags & GUARDED) || connected(binding as Guarded))) {
            if (flags & ONCE) {
                binding.release();
            }

            try {
                listener.call(node ?? (binding as Member).self, e, binding.release);
            }
            catch (error) {
                (errors ??= []).push(error);
            }
        }

        binding = binding.next;
    }

    return errors;
}

function subscribe(
    registration: Registration,
    target: EventTarget,
    listener: Function,
    flags: number,
    owner: Element | null,
    parent: Slot | null,
    signal: AbortSignal | undefined
): VoidFunction {
    // As in chain(), the per-binding closure reads back rather than captures
    let slot = registration.slot,
        tail = registration.tail,
        release = () => {
            if (binding.listener === undefined) {
                return;
            }

            binding.listener = undefined;

            // A released binding keeps its next, so a dispatch standing on it carries on
            let next = binding.next,
                prev = binding.prev;

            if (prev === null) {
                registration.head = next;
            }
            else {
                prev.next = next;
            }

            if (next === null) {
                registration.tail = prev;
            }
            else {
                next.prev = prev;
            }

            if (binding.flags & ATTRIBUTE && binding.anchor![registration.slot] === binding) {
                binding.anchor![registration.slot] = undefined;
            }

            binding.disposed = true;
            signal?.removeEventListener('abort', release);
            registration.release();
        },
        binding: Member = {
            anchor: owner,
            disposed: false,
            flags,
            listener,
            next: null,
            parent,
            prev: tail,
            release,
            // Attribute keys run with their element, as delegated ones do; on() runs with its target
            self: flags & ATTRIBUTE ? owner : target,
            state: 0
        };

    if (tail === null) {
        registration.head = binding;
    }
    else {
        tail.next = binding;
    }

    registration.count++;
    registration.tail = binding;

    if (flags & ATTRIBUTE) {
        let previous = owner![slot] as Member | undefined;

        owner![slot] = binding;
        previous?.release();
    }

    if (owner !== null) {
        disconnect(owner, release);
    }

    signal?.addEventListener('abort', release);

    return release;
}


// delegate, direct, ondocument and onwindow bind event attribute keys as routed by ./parse, which is what the compiler
// emits: one binding per element and event, a later one replacing the earlier, released with the element
const delegate = ((element: Element, event: string, listener: Function, options?: Once) => {
    chain(documents[event] ?? registration(document, event, false, undefined), element, listener, attribute(options), element, null, undefined);
}) as Keyed<'on'>;

const direct = ((element: Element, event: string, listener: Function, options?: Once) => {
    subscribe(registration(element, event, false, undefined), element, listener, attribute(options), element, null, undefined);
}) as Keyed<'on'>;

const on = ((target: EventTarget, event: string, listener: Function, options?: EventOptions) =>
    bind(target, event, listener, options, 0, null, null)) as On;

// Once the element first connects, 'listener' gets it and an on() whose bindings are guarded by the element and released
// with it. The guard heals the slot rendering the element, which is only current now, not at connect.
const onconnect = (element: Element, listener: NonNullable<Attributes['onconnect']>): void => {
    let parent = context();

    connect(element, () => {
        listener(
            element,
            ((target: EventTarget, event: string, fn: Function, options?: EventOptions) =>
                bind(target, event, fn, options, GUARDED, element, parent)) as On
        );
    });
};

const ondisconnect = (element: Element, listener: NonNullable<Attributes[`ondisconnect`]>) => {
    disconnect(element, () => listener(element));
};

// Run only while the element is in the document
const ondocument = ((element: Element, event: string, listener: Function, options?: Once) => {
    subscribe(documents[event] ?? registration(document, event, false, undefined), document, listener, attribute(options) | GUARDED, element, context(), undefined);
}) as Keyed<'ondocument'>;

const onwindow = ((element: Element, event: string, listener: Function, options?: Once) => {
    subscribe(registration(window, event, false, undefined), window, listener, attribute(options) | GUARDED, element, context(), undefined);
}) as Keyed<'onwindow'>;

const hooks = { onconnect, ondisconnect, onfirstpaint, ontick };

const routes: Record<Route, (element: Element, event: string, listener: Function, options?: Once) => void> = {
    delegate,
    direct,
    ondocument,
    onwindow
};

const runtime = <E extends `on${string}`>(element: Element, name: E, listener: Attributes[E]): void => {
    let key = parse(name);

    if (key.event === null) {
        hooks[key.route](element, listener as never);
    }
    else {
        routes[key.route](element, key.event, listener as Function, key.once ? OPTIONS_ONCE : undefined);
    }
};


export { delegate, direct, on, onconnect, ondisconnect, ondocument, onfirstpaint, ontick, onwindow, runtime };
