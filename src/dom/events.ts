import { EventListener } from '~/types';


let capture = 'blur focus scroll',
    keys: Record<string, symbol> = {},
    passive = 'mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup mousewheel scroll touchcancel touchend touchleave touchmove touchstart wheel',
    root = window.document;


const register = (element: HTMLElement & Record<PropertyKey, any>, event: string, listener: EventListener): void => {
    let key = keys[event];

    if (key === undefined) {
        key = keys[event] = Symbol();

        root.addEventListener(event, (e) => {
            let element = e.target as (HTMLElement & Record<PropertyKey, any>) | null;

            Object.defineProperty(e, 'currentTarget', {
                configurable: true,
                get() {
                    return element || root;
                }
            });

            while (element) {
                if (key in element) {
                    return element[key].call(element, e);
                }

                element = element.parentElement;
            }
        }, {
            capture: capture.indexOf(event) !== -1,
            passive: passive.indexOf(event) !== -1
        });
    }

    element[key] = listener;
};


export default { register };