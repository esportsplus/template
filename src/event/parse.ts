import { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS, PACKAGE_NAME } from '../constants';


type Hook = 'onconnect' | 'ondisconnect' | 'onfirstpaint' | 'ontick';

// 'route' names the export of ./index that binds the key, which is also what the compiler emits
type Key =
    | { event: null; once: false; route: Hook }
    | { event: string; once: boolean; route: Route };

type Route = 'delegate' | 'direct' | 'ondocument' | 'onwindow';


// DOM-free, so the compiler routes an attribute key at build time exactly as runtime() does for a spread one
const parse = (name: `on${string}`): Key => {
    let key = name.toLowerCase();

    if (key === 'on') {
        throw new Error(`${PACKAGE_NAME}: '${name}' is not an attribute; bind listeners through onconnect's second argument, (element, on) => { on(target, event, listener, options); }`);
    }

    if (LIFECYCLE_EVENTS.has(key)) {
        return { event: null, once: false, route: key as Hook };
    }

    // No DOM event starts with 'ce', so a match can only be the prefix
    let i = 2,
        once = false;

    if (key.startsWith('ce', 2)) {
        i = 4;
        once = true;
    }

    if (key.startsWith('active', i)) {
        throw new Error(`${PACKAGE_NAME}: '${name}' is not an event attribute; bind a cancelable listener through onconnect's second argument, 'on', with 'passive: false'`);
    }

    if (key.startsWith('document', i)) {
        return { event: key.slice(i + 8), once, route: 'ondocument' };
    }

    if (key.startsWith('window', i)) {
        return { event: key.slice(i + 6), once, route: 'onwindow' };
    }

    let event = key.slice(i);

    return { event, once, route: DIRECT_ATTACH_EVENTS.has(event) ? 'direct' : 'delegate' };
};


export default parse;
export type { Hook, Key, Route };
