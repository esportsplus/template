const ATTRIBUTES = Symbol();


const NODE_CLOSING = 1;

const NODE_COMMENT = 2;

const NODE_ELEMENT = 3;

const NODE_SLOT = 4;

const NODE_VOID = 5;

const NODE_WHITELIST: Record<string, number> = {
    '/': NODE_CLOSING,
    '!': NODE_COMMENT,

    'area': NODE_VOID,
    'base': NODE_VOID,
    'br': NODE_VOID,
    'col': NODE_VOID,
    'embed': NODE_VOID,
    'hr': NODE_VOID,
    'img': NODE_VOID,
    'input': NODE_VOID,
    'keygen': NODE_VOID,
    'link': NODE_VOID,
    'menuitem': NODE_VOID,
    'meta': NODE_VOID,
    'param': NODE_VOID,
    'source': NODE_VOID,
    'track': NODE_VOID,
    'wbr': NODE_VOID
};


const REGEX_EMPTY_TEXT_NODES = /(>|})\s+(<|{)/g;

const REGEX_EVENTS = /(?:\s*on[\w-:]+\s*=\s*["'][^"']*["'])/g;

const REGEX_EXTRA_WHITESPACE = /\s\s+/g;

const REGEX_SLOT_ATTRIBUTES = /<[\w-]+([^><]*{{\$}}[^><]*)>/g;

const REGEX_SLOT_NODES = /<([\w-]+|[\/!])(?:([^><]*{{\$}}[^><]*)|(?:[^><]*))?>|{{\$}}/g;


const RENDERABLE = Symbol();

const RENDERABLE_REACTIVE = Symbol();

const RENDERABLE_TEMPLATE = Symbol();


const SLOT = Symbol();

const SLOT_HTML = '<!--$-->';

const SLOT_MARKER = '{{$}}';


export {
    ATTRIBUTES,
    NODE_CLOSING,
    NODE_ELEMENT,
    NODE_SLOT,
    NODE_VOID,
    NODE_WHITELIST,
    REGEX_EMPTY_TEXT_NODES,
    REGEX_EVENTS,
    REGEX_EXTRA_WHITESPACE,
    REGEX_SLOT_ATTRIBUTES,
    REGEX_SLOT_NODES,
    RENDERABLE,
    RENDERABLE_REACTIVE,
    RENDERABLE_TEMPLATE,
    SLOT,
    SLOT_HTML,
    SLOT_MARKER
};