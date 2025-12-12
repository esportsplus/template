import { root } from '@esportsplus/reactivity';
import { defineProperty } from '@esportsplus/utilities';
import { Element } from '~/types';
import { addEventListener } from '~/utilities/element';
import { parentElement } from '~/utilities/node';
import { ondisconnect } from '~/slot/cleanup';
import onconnect from './onconnect';
import onresize from './onresize';
import ontick from './ontick';


let capture = new Set<`on${string}`>(['onblur', 'onfocus', 'onscroll']),
    controllers = new Map<
        `on${string}`,
        (AbortController & { listeners: number }) | null
    >(),
    keys: Record<string, symbol> = {},
    passive = new Set<`on${string}`>([
        'onanimationend', 'onanimationiteration', 'onanimationstart',
        'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel',
        'onpointerenter', 'onpointerleave', 'onpointermove', 'onpointerout', 'onpointerover',
        'onscroll',
        'ontouchcancel', 'ontouchend', 'ontouchleave', 'ontouchmove', 'ontouchstart', 'ontransitionend',
        'onwheel'
    ]);


(['onmousemove', 'onmousewheel', 'onscroll', 'ontouchend', 'ontouchmove', 'ontouchstart', 'onwheel'] as `on${string}`[]).map(event => {
    controllers.set(event, null);
});


function register(element: Element, event: `on${string}`) {
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

    addEventListener.call(window.document, event.slice(2), (e) => {
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

            node = parentElement.call(node);
        }
    }, {
        capture: capture.has(event),
        passive: passive.has(event),
        signal
    });

    return key;
}


export default (element: Element, event: `on${string}`, listener: Function): void => {
    switch (event) {
        case 'onconnect':
            onconnect(element, listener);
            return;

        case 'ondisconnect':
            ondisconnect(element, () => listener(element));
            return;

        case 'onrender':
            root(() => listener(element));
            return;

        case 'onresize':
            onresize(element, listener);
            return;

        case 'ontick':
            ontick(element, listener);
            return;

        default:
            element[ keys[event] || register(element, event) ] = listener;
            return;
    }
};