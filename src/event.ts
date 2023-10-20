import { Element } from './types';
import { addEventListener } from './utilities';


let capture = new Set(['blur', 'focus', 'scroll']),
    keys: Record<string, symbol> = {},
    passive = new Set([
        'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'mousewheel',
        'scroll',
        'touchcancel', 'touchend', 'touchleave', 'touchmove', 'touchstart',
        'wheel'
    ]),
    root = window.document;


function register(event: string) {
    let key = keys[event] = Symbol(),
        type = event.slice(2);

    addEventListener.call(root, type, (e) => {
        let node = e.target as Element | null;

        Object.defineProperty(e, 'currentTarget', {
            configurable: true,
            get() {
                return node || root;
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


export default ({ name }: { name: string }, element: Element, listener: unknown): void => {
    if (typeof listener !== 'function') {
        throw new Error(`Template: delegated event handler received an invalid listener ${JSON.stringify(listener)}`);
    }

    if (name === 'onrender') {
        return listener(element);
    }

    element[keys[name] || register(name)] = listener;
};