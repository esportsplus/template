const PACKAGE_NAME = '@esportsplus/template';

const ANCHOR_LAST = 2;

const ANCHOR_MARKER = 0;

const ANCHOR_SOLE = 1;

const ARRAY_SLOT = Symbol.for(`${PACKAGE_NAME}/array.slot`);

const ATTRIBUTE_DELIMITERS: Record<string, string> = {
    class: ' ',
    style: ';'
};

// Holds the cleanups of content built outside any owner until a template insertion adopts them
const CLEANUP = Symbol.for(`${PACKAGE_NAME}/cleanup`);

const DIRECT_ATTACH_EVENTS = new Set<string>([
    'abort',
    'blur',
    'cancel',
    'canplay',
    'canplaythrough',
    'close',
    'durationchange',
    'emptied',
    'ended',
    'error',
    'focus', 'focusin', 'focusout',
    'invalid',
    'loadeddata',
    'loadedmetadata',
    'load',
    'loadstart',
    'mouseenter', 'mouseleave',
    'pause',
    'play',
    'playing',
    'pointerenter', 'pointerleave',
    'progress',
    'ratechange',
    'reset',
    'scroll',
    'seeked', 'seeking',
    'stalled',
    'submit',
    'suspend',
    'timeupdate',
    'toggle',
    'volumechange',
    'waiting'
]);

const LIFECYCLE_EVENTS = new Set<string>([
    'onconnect', 'ondisconnect', 'onfirstpaint', 'ontick'
]);

// Only listeners for these can hold up scrolling, so the template registers them passive unless told otherwise
const PASSIVE_EVENTS = ['touchmove', 'touchstart', 'wheel'] as const;

const SLOT_HTML = '<!--$-->';

const STORE = Symbol.for(`${PACKAGE_NAME}/store`);

// Tail of every error the uncompiled html runtime throws. The build rejects any chunk containing
// it: the runtime surviving tree-shaking means some module reached html without being compiled.
const UNCOMPILED = 'must be compiled. Ensure vite-plugin is configured.';


export {
    ANCHOR_LAST, ANCHOR_MARKER, ANCHOR_SOLE,
    ARRAY_SLOT, ATTRIBUTE_DELIMITERS,
    CLEANUP,
    DIRECT_ATTACH_EVENTS,
    LIFECYCLE_EVENTS,
    PACKAGE_NAME, PASSIVE_EVENTS,
    SLOT_HTML, STORE,
    UNCOMPILED
};
