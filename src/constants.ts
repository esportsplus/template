const ATTRIBUTES = Symbol();


const EMPTY_ARRAY = Object.freeze([]) as any as any[];


const NODE_CLOSING = 1;

const NODE_COMMENT = 2;

const NODE_ELEMENT = 3;

const NODE_SLOT = 4;

const NODE_VOID = 5;


const NODE_TYPES: Record<string, number> = {
    '/': NODE_CLOSING,
    '!': NODE_COMMENT,
    '!--$--': NODE_SLOT,

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


const RENDERABLE = Symbol();


const SLOT = Symbol();

const SLOT_ATTRIBUTE_REGEX = /([\w-:]+|\.\.\.)(?:(?:=["']([^"']*<!--\$-->[^"']*)["'])|(<!--\$-->))/g;

const SLOT_HTML = '<!--$-->';

const SLOT_NODE_REGEX = /<(!--\$--|[\/!]|[\w-]+)((?:\s*[\w-:]+\s*=\s*["'](?:[^"']*)["'])*(?:[^\/]*>|[^\/>]*))(\/)?>/g;

const SLOT_REPLACE_REGEX = /<!--\$-->/g;


const TEMPLATE_CLEANUP_REGEX = /(?:\s*on[\w-:]+\s*=\s*["'][^"']*<!--\$-->[^"']*["'])|(?:\s*\.\.\.<!--\$-->)/g;

const TEMPLATE_NORMALIZE_REGEX = /(?:\s|;)+(<)|(>)(?:\s|;)+/g;


export {
    ATTRIBUTES,
    EMPTY_ARRAY,
    NODE_CLOSING,
    NODE_ELEMENT,
    NODE_SLOT,
    NODE_TYPES,
    NODE_VOID,
    RENDERABLE,
    SLOT,
    SLOT_ATTRIBUTE_REGEX,
    SLOT_HTML,
    SLOT_NODE_REGEX,
    SLOT_REPLACE_REGEX,
    TEMPLATE_CLEANUP_REGEX,
    TEMPLATE_NORMALIZE_REGEX
};