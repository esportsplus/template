const ARRAY_SLOT = Symbol('template.array.slot');

const ATTRIBUTE_DELIMITERS: Record<string, string> = {
    class: ' ',
    style: ';'
};

const CLEANUP = Symbol('template.cleanup');

const DIRECT_ATTACH_EVENTS = new Set<string>([
    'onblur',
    'onerror',
    'onfocus', 'onfocusin', 'onfocusout',
    'onload',
    'onmouseenter', 'onmouseleave',
    'onplay', 'onpause', 'onended', 'ontimeupdate',
    'onreset',
    'onscroll', 'onsubmit'
]);

const LIFECYCLE_EVENTS = new Set<string>([
    'onconnect', 'ondisconnect', 'onrender', 'onresize', 'ontick'
]);

const PACKAGE_NAME = '@esportsplus/template';

const SLOT_HTML = '<!--$-->';

const STATE_HYDRATING = 0;

const STATE_NONE = 1;

const STATE_WAITING = 2;

const STORE = Symbol('template.store');


export {
    ARRAY_SLOT, ATTRIBUTE_DELIMITERS,
    CLEANUP,
    DIRECT_ATTACH_EVENTS,
    LIFECYCLE_EVENTS,
    PACKAGE_NAME,
    SLOT_HTML, STATE_HYDRATING, STATE_NONE, STATE_WAITING, STORE,
};
