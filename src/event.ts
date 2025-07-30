import { root } from '@esportsplus/reactivity';
import { oncleanup } from './slot';
import { Element } from './types';
import { addEventListener, defineProperty, parentElement } from './utilities';


let capture = new Set<`on${string}`>(['onblur', 'onfocus', 'onscroll']),
    controllers = new Map<
        `on${string}`,
        (AbortController & { listeners: number }) | null
    >(),
    keys: Record<string, symbol> = {},
    passive = new Set<`on${string}`>([
        'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel',
        'onscroll',
        'ontouchcancel', 'ontouchend', 'ontouchleave', 'ontouchmove', 'ontouchstart',
        'onwheel'
    ]);


(['onmousemove', 'onmousewheel', 'onscroll', 'ontouchend', 'ontouchmove', 'ontouchstart', 'onwheel'] as `on${string}`[]).map(event => {
    controllers.set(event, null);
});


export default (element: Element, event: `on${string}`, listener: Function) => {
    if (event === 'onmount') {
        let interval = setInterval(() => {
                retry--;

                if (element.isConnected) {
                    retry = 0;
                    root(() => listener(element), scheduler);
                }

                if (retry === 0) {
                    clearInterval(interval);
                }
            }, 1000 / 60),
            retry = 60,
            scheduler = root(({ scheduler }) => scheduler);

        return;
    }
    else if (event === 'onrender') {
        return root(() => listener(element));
    }

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

        oncleanup(element, () => {
            if (--controller.listeners) {
                return;
            }

            controller.abort();
            controllers.set(event, null);
        });
        signal = controller.signal;
    }

    let key = keys[event];

    if (!key) {
        key = keys[event] = Symbol();

        addEventListener.call(window.document, event.slice(2), (e) => {
            let node = e.target as Element | null;

            defineProperty(e, 'currentTarget', {
                configurable: true,
                get() {
                    return node || window.document;
                }
            });

            while (node) {
                if (key in node) {
                    return (node[key] as Function).call(node, e);
                }

                node = parentElement.call(node);
            }
        }, {
            capture: capture.has(event),
            passive: passive.has(event),
            signal
        });
    }

    element[key] = listener;
};