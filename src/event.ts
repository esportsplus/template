import { root } from '@esportsplus/reactivity';
import { Element } from './types';
import { addEventListener } from './utilities';


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

        Object.defineProperty(e, 'currentTarget', {
            configurable: true,
            get() {
                return node || window.document;
            }
        });

        while (node) {
            if (key in node) {
                return (node[key] as Function).call(node, e);
            }

            node = node.parentElement as Element | null;
        }
    }, {
        capture: capture.has(type),
        passive: passive.has(type)
    });

    return key;
}


export default (element: Element, listener: Function, name: string): void => {
    if (name === 'onrender') {
        return root(() => listener(element));
    }

    element[keys[name] || register(name)] = listener;
};