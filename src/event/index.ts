import { root } from '@esportsplus/reactivity';
import { defineProperty } from '@esportsplus/utilities';
import { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS } from '../constants';
import { ondisconnect as disconnect } from '../slot';
import { Attributes, Element } from '../types';
import onconnect from './onconnect';
import onresize from './onresize';
import ontick from './ontick';


let controllers = new Map<string, (AbortController & { listeners: number }) | null>(),
    host = window.document,
    keys: Record<string, symbol> = {},
    passive = new Set<string>([
        'animationend', 'animationiteration', 'animationstart',
        'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'mousewheel',
        'pointerenter', 'pointerleave', 'pointermove', 'pointerout', 'pointerover',
        'scroll',
        'touchcancel', 'touchend', 'touchleave', 'touchmove', 'touchstart', 'transitionend',
        'wheel'
    ]);


(['mousemove', 'mousewheel', 'scroll', 'touchend', 'touchmove', 'touchstart', 'wheel'] as string[]).map(event => {
    controllers.set(event, null);
});


function register(element: Element, event: string) {
    let controller = controllers.get(event),
        signal: AbortController['signal'] | undefined;

    if (controller === null) {
        let { abort, signal } = new AbortController();

        controllers.set(
            event,
            controller = {
                abort,
                signal,
                listeners: 0,
            }
        );
    }

    if (controller) {
        controller.listeners++;

        ondisconnect(element, () => {
            if (--controller.listeners) {
                return;
            }

            controller.abort();
            controllers.set(event, null);
        });
        signal = controller.signal;
    }

    let key = keys[event] = Symbol();

    host.addEventListener(event, (e) => {
        let fn,
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

                return fn.call(node, e);
            }

            node = node.parentElement as Element | null;
        }
    }, {
        passive: passive.has(event),
        signal
    });

    return key;
}


const delegate = <E extends string>(element: Element, event: E, listener: Attributes[`on${E}`]): void => {
    element[ keys[event] || register(element, event) ] = listener;
};

// DIRECT_ATTACH_EVENTS in ./constants.ts tells compiler to use this function
const on = <E extends string>(element: Element, event: E, listener: Attributes[`on${E}`]): void => {
    let handler = (e: Event) => (listener as Function).call(element, e);

    element.addEventListener(event, handler, {
        passive: passive.has(event)
    });

    ondisconnect(element, () => {
        element.removeEventListener(event, handler);
    });
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
