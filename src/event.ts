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
    if (event === 'onrender') {
        return root(() => listener(element));
    }

    element[keys[event] || register(event)] = listener;
};