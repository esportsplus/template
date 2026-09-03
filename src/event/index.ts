import { root } from '@esportsplus/reactivity';
import { defineProperty } from '@esportsplus/utilities';
import { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS } from '../constants';
import { ondisconnect as disconnect } from '../slot';
import { Attributes, Element } from '../types';
import onconnect from './onconnect';
import onresize from './onresize';
import ontick from './ontick';


let host = window.document,
    passive = new Set<string>([
        'animationend', 'animationiteration', 'animationstart',
        'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover', 'mouseup',
        'pointerenter', 'pointerleave', 'pointermove', 'pointerout', 'pointerover',
        'scroll',
        'touchcancel', 'touchend', 'touchleave', 'touchmove', 'touchstart', 'transitionend',
        'wheel'
    ]),
    registrations: Record<string, { counter: number, key: symbol; ondisconnect: VoidFunction } | null> = {},
    symbols: Record<string, symbol> = {};


function register(event: string) {
    let key = Symbol(),
        handler = (e: Event) => {
            let data,
                fn,
                node = e.target as Element | null;

            while (node) {
                fn = node[key];

                if (typeof fn === 'function') {
                    defineProperty(e, 'currentTarget', {
                        configurable: true,
                        get() {
                            return node || window.document;
                        }
                    });

                    data = node[symbol];

                    return data !== undefined ? fn.call(node, data, e) : fn.call(node, e);
                }

                node = node.parentElement as Element | null;
            }
        },
        symbol = symbols[event] = Symbol();

    host.addEventListener(event, handler, {
        passive: passive.has(event)
    });

    let registration = {
            counter: 0,
            key,
            ondisconnect: () => {
                if (--registration.counter) {
                    return;
                }

                host.removeEventListener(event, handler);
                registrations[event] = null;
            }
        };

    return registration;
}


const delegate = <E extends string>(element: Element, event: E, listener: Attributes[`on${E}`], data?: unknown): void => {
    let registration = registrations[event] ??= register(event);

    registration.counter++;
    element[registration.key] = listener;

    if (data !== undefined) {
        element[ symbols[event] ] = data;
    }

    disconnect(element, registration.ondisconnect);
};

// DIRECT_ATTACH_EVENTS in ./constants.ts tells compiler to use this function
const on = <E extends string>(element: Element, event: E, listener: Attributes[`on${E}`]): void => {
    let handler = (e: Event) => (listener as Function).call(element, e);

    element.addEventListener(event, handler, {
        passive: passive.has(event)
    });

    disconnect(element, () => element.removeEventListener(event, handler));
};

const ondisconnect = (element: Element, listener: NonNullable<Attributes[`ondisconnect`]>) => {
    disconnect(element, () => listener(element));
};

const onrender = (element: Element, listener: NonNullable<Attributes[`onrender`]>) => {
    root(() => listener(element));
};

const lifecycle = { onconnect, ondisconnect, onrender, onresize, ontick };

const runtime = <E extends `on${string}`>(element: Element, event: E, listener: Attributes[E]): void => {
    let key = event.toLowerCase();

    if (LIFECYCLE_EVENTS.has(key)) {
        lifecycle[key as keyof typeof lifecycle](element, listener as any);
    }
    else {
        (DIRECT_ATTACH_EVENTS.has(key) ? on : delegate)(element, key.slice(2), listener);
    }
};


export { delegate, on, onconnect, ondisconnect, onrender, onresize, ontick, runtime };
