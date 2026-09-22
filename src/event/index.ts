import { root } from '@esportsplus/reactivity';
import { defineProperty } from '@esportsplus/utilities';
import { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS, PACKAGE_NAME } from '../constants';
import { ondisconnect as disconnect } from '../slot';
import { Attributes, Element } from '../types';
import onconnect from './onconnect';
import ontick from './ontick';


type Binding = { listener: Function | undefined; once: boolean; remove: VoidFunction };

type Host = Document | Window;

type Registration = { counter: number; key: symbol; members: Set<Binding> | null; release: VoidFunction };


let passive = new Set<string>([
        'animationend', 'animationiteration', 'animationstart',
        'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover', 'mouseup',
        'pointerenter', 'pointerleave', 'pointermove', 'pointerout', 'pointerover',
        'scroll',
        'touchcancel', 'touchend', 'touchleave', 'touchmove', 'touchstart', 'transitionend',
        'wheel'
    ]),
    registrations: Record<string, Registration | null> = {},
    symbols: Record<string, symbol> = {};


function attach(element: Element, registration: Registration, listener: Function, once: boolean): void {
    let key = registration.key,
        members = registration.members,
        previous = element[key] as Binding | undefined,
        binding: Binding = {
            listener,
            once,
            remove: () => {
                if (binding.listener === undefined) {
                    return;
                }

                binding.listener = undefined;

                if (members) {
                    members.delete(binding);
                }

                if (element[key] === binding) {
                    element[key] = undefined;
                }

                registration.release();
            }
        };

    element[key] = binding;
    registration.counter++;

    if (members) {
        members.add(binding);
    }

    previous?.remove();
    disconnect(element, binding.remove);
}

function delegated(key: symbol) {
    return (e: Event) => {
        let node = e.target as Element | null;

        while (node) {
            let binding = node[key] as Binding | undefined;

            if (binding) {
                let listener = binding.listener;

                if (binding.once) {
                    binding.remove();
                }

                defineProperty(e, 'currentTarget', {
                    configurable: true,
                    value: node
                });

                try {
                    listener!.call(node, e);
                }
                finally {
                    // Later host listeners must see the native currentTarget
                    delete (e as unknown as Record<string, unknown>).currentTarget;
                }

                return;
            }

            node = node.parentElement as Element | null;
        }
    };
}

function global(host: Host, members: Set<Binding>) {
    return (e: Event) => {
        let errors: unknown[] | null = null;

        // Live iteration: a member removed mid-dispatch is skipped, one added fires this event
        for (let binding of members) {
            let listener = binding.listener;

            if (binding.once) {
                binding.remove();
            }

            try {
                listener!.call(host, e);
            }
            catch (error) {
                (errors ??= []).push(error);
            }
        }

        if (errors) {
            throw errors.length === 1
                ? errors[0]
                : new AggregateError(errors, `${PACKAGE_NAME}: host event handlers produced multiple errors`);
        }
    };
}

function register(host: Host, event: string, name: string): Registration {
    let key = Symbol(),
        members = name === event ? null : new Set<Binding>(),
        handler = members ? global(host, members) : delegated(key),
        registration: Registration = {
            counter: 0,
            key,
            members,
            release: () => {
                if (--registration.counter) {
                    return;
                }

                host.removeEventListener(event, handler);
                registrations[name] = null;
            }
        };

    host.addEventListener(event, handler, { passive: passive.has(event) });

    return registrations[name] = registration;
}


const delegate = <E extends string>(element: Element, event: E, listener: Attributes[`on${E}`], once: boolean = false): void => {
    attach(
        element,
        registrations[event] ??= register(window.document, event, event),
        listener as Function,
        once
    );
};

// DIRECT_ATTACH_EVENTS in ../constants.ts tells the compiler to use this function
const on = <E extends string>(element: Element, event: E, listener: Attributes[`on${E}`], once: boolean = false): void => {
    let key = symbols[event] ??= Symbol(),
        previous = element[key] as VoidFunction | undefined,
        handler = (e: Event) => {
            if (once) {
                remove();
            }

            (listener as Function).call(element, e);
        },
        remove = () => {
            if (element[key] !== remove) {
                return;
            }

            element[key] = undefined;
            element.removeEventListener(event, handler);
        };

    // The previous remover only acts while it still owns the slot, so run it before taking over
    previous?.();
    element[key] = remove;
    element.addEventListener(event, handler, { passive: passive.has(event) });
    disconnect(element, remove);
};

const ondisconnect = (element: Element, listener: NonNullable<Attributes[`ondisconnect`]>) => {
    disconnect(element, () => listener(element));
};

const ondocument = <E extends string>(element: Element, event: E, listener: Attributes[`ondocument${E}`], once: boolean = false): void => {
    let name = 'document' + event;

    attach(
        element,
        registrations[name] ??= register(window.document, event, name),
        listener as Function,
        once
    );
};

const onrender = (element: Element, listener: NonNullable<Attributes[`onrender`]>) => {
    root(() => listener(element));
};

const onwindow = <E extends string>(element: Element, event: E, listener: Attributes[`onwindow${E}`], once: boolean = false): void => {
    let name = 'window' + event;

    attach(
        element,
        registrations[name] ??= register(window, event, name),
        listener as Function,
        once
    );
};

const lifecycle = { onconnect, ondisconnect, onrender, ontick };

const runtime = <E extends `on${string}`>(element: Element, name: E, listener: Attributes[E]): void => {
    let key = name.toLowerCase();

    if (LIFECYCLE_EVENTS.has(key)) {
        lifecycle[key as keyof typeof lifecycle](element, listener as any);
        return;
    }

    // Character gates only: the Attributes type rejects every DOM event starting with 'ce',
    // 'doc' or 'wi', so a match can only be a prefix ('domcontentloaded' is why 'doc' needs three)
    let i = 2,
        once = false;

    if (key[2] === 'c' && key[3] === 'e') {
        i = 4;
        once = true;
    }

    if (key[i] === 'd' && key[i + 1] === 'o' && key[i + 2] === 'c') {
        ondocument(element, key.slice(i + 8), listener, once);
    }
    else if (key[i] === 'w' && key[i + 1] === 'i') {
        onwindow(element, key.slice(i + 6), listener, once);
    }
    else {
        let event = key.slice(i);

        if (DIRECT_ATTACH_EVENTS.has('on' + event)) {
            on(element, event, listener, once);
        }
        else {
            delegate(element, event, listener, once);
        }
    }
};


export { delegate, on, onconnect, ondisconnect, ondocument, onrender, ontick, onwindow, runtime };
