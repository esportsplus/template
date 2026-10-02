import { ondisconnect } from '../slot';
import { Element } from '../types';


// Where a cancelable listener is needed: from an event that starts the gesture on the element to one that ends it.
type Scope = {
    end: string[];
    ends?: (e: Event) => boolean;
    start: string[];
    starts?: (e: Event) => boolean;
};


// 'pointerdown' comes before 'touchstart', so the listener is in place for the touch's first event; it lasts until
// every finger has lifted.
const TOUCH: Scope = {
    end: ['touchcancel', 'touchend'],
    ends: (e) => (e as TouchEvent).touches.length === 0,
    start: ['pointerdown'],
    starts: (e) => (e as PointerEvent).pointerType !== 'mouse'
};

// A passive event missing here is cancelable for as long as the element lives.
const SCOPES: Record<string, Scope> = {
    touchmove: TOUCH,
    touchstart: TOUCH,
    // Nothing comes before a wheel event, so it is in place while the pointer is over the element; a move, not an
    // enter, so an element rendered under a resting pointer binds too.
    wheel: { end: ['pointerleave'], start: ['pointermove'] }
};


// A cancelable listener for an event the template otherwise registers passive, bound only while its gesture lasts:
// a cancelable listener makes the browser wait on script before scrolling.
export default (element: Element, event: string, listener: Function): void => {
    let gesture: AbortController | null = null,
        handler = (e: Event) => {
            listener.call(element, e);
        },
        lifetime = new AbortController(),
        scope = SCOPES[event];

    ondisconnect(element, () => {
        gesture?.abort();
        lifetime.abort();
    });

    if (!scope) {
        element.addEventListener(event, handler, { passive: false, signal: lifetime.signal });
        return;
    }

    let { end, ends, start, starts } = scope;

    function bind(e: Event) {
        if (gesture || (starts && !starts(e))) {
            return;
        }

        gesture = new AbortController();
        element.addEventListener(event, handler, { passive: false, signal: gesture.signal });
    }

    function unbind(e: Event) {
        if (!gesture || (ends && !ends(e))) {
            return;
        }

        gesture.abort();
        gesture = null;
    }

    for (let i = 0, n = start.length; i < n; i++) {
        element.addEventListener(start[i], bind, { passive: true, signal: lifetime.signal });
    }

    for (let i = 0, n = end.length; i < n; i++) {
        element.addEventListener(end[i], unbind, { passive: true, signal: lifetime.signal });
    }
};
