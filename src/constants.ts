import { fragment } from './utilities';
import { SLOT_HTML } from './shared-constants';


const ARRAY_SLOT = Symbol('template.array.slot');


const CLEANUP = Symbol('template.cleanup');


const EMPTY_FRAGMENT = fragment('');


const STATE_HYDRATING = 0;

const STATE_NONE = 1;

const STATE_WAITING = 2;


const STORE = Symbol('template.store');


// Pre-allocate on Node prototype to optimize property access
if (typeof Node !== 'undefined') {
    (Node.prototype as any)[CLEANUP] = null;
    (Node.prototype as any)[STORE] = null;
}


export {
    ARRAY_SLOT,
    CLEANUP,
    EMPTY_FRAGMENT,
    SLOT_HTML, STATE_HYDRATING, STATE_NONE, STATE_WAITING, STORE
};
