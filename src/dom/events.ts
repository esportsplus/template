import { EVENT_BAIL, EVENT_DELEGATED, EVENT_LISTENER } from '~/constants';
import { EventAction, EventListener } from '~/types';


let bail: EventAction = {
        type: EVENT_BAIL,
        value: null
    },
    cache: Record<string, WeakMap<HTMLElement, EventAction>> = {},
    capture = 'blur focus scroll',
    host = document.body,
    passive = 'mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup mousewheel scroll touchcancel touchend touchleave touchmove touchstart wheel';


const register = (element: HTMLElement, event: string, listener: EventListener): void => {
    let attribute = `data-${event}`,
        config = cache[event];

    if (!config) {
        config = cache[event] = new WeakMap();

        host.addEventListener(event, (e) => {
            let element: HTMLElement | null = e.target as HTMLElement,
                target = element;

            e.stopPropagation();

            while (element) {
                if (element.hasAttribute(attribute)) {
                    let data = config.get(element) || bail;

                    if (data.type === EVENT_DELEGATED) {
                        data = config.get(data.value as HTMLElement) || bail;
                    }

                    if (data.type === EVENT_LISTENER) {
                        if (element.isSameNode(target) === false) {
                            config.set(target, {
                                type: EVENT_DELEGATED,
                                value: element
                            });
                        }

                        (data.value as EventListener).call(element, e);
                    }

                    return;
                }

                element = element.parentElement;
            }

            config.set(target, bail);
        }, {
            capture: capture.indexOf(event) !== -1,
            passive: passive.indexOf(event) !== -1
        });
    }

    config.set(element, {
        type: EVENT_LISTENER,
        value: listener
    });
};


export default { register };