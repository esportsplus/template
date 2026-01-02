const DIRECT_ATTACH_EVENTS = new Set<string>([
    'onblur',
    'onerror',
    'onfocus', 'onfocusin', 'onfocusout',
    'onload',
    'onplay', 'onpause', 'onended', 'ontimeupdate',
    'onreset',
    'onscroll', 'onsubmit'
]);

const LIFECYCLE_EVENTS = new Set<string>([
    'onconnect', 'ondisconnect', 'onrender', 'onresize', 'ontick'
]);


export { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS };