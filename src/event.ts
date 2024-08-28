import { root } from '@esportsplus/reactivity';
import { Element } from './types';
import { addEventListener, defineProperty, parentElement } from './utilities';


let capture = new Set(['blur', 'focus', 'scroll']),
    keys: Record<string, symbol> = {},
    passive = new Set([
        'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'mousewheel',
        'scroll',
        'touchcancel', 'touchend', 'touchleave', 'touchmove', 'touchstart',
        'wheel'
    ]);


function register(event: string) {
    let key = keys[event] = Symbol(),
        type = event.slice(2);

    addEventListener.call(window.document, type, (e) => {
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
        capture: capture.has(type),
        passive: passive.has(type)
    });

    return key;
}


export default (element: Element, event: string, listener: Function): void => {
    if (event === 'onmount') {
        let interval: ReturnType<typeof setInterval> = setInterval(() => {
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

    element[keys[event] || register(event)] = listener;
};