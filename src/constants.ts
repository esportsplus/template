const ATTRIBUTES = Symbol();


const NODE_CLOSING = 1;

const NODE_COMMENT = 2;

const NODE_ELEMENT = 3;

const NODE_SLOT = 4;

const NODE_VOID = 5;


const NODE_TYPES: Record<string, number> = {
    '/': NODE_CLOSING,
    '!': NODE_COMMENT,
    '!--slot--': NODE_SLOT,

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


const SLOT = Symbol();

const SLOT_HTML = '<!--slot-->';

const SLOT_ATTRIBUTE_REGEX = /([\w-:]+)=["']([^"']*<!--slot-->[^"']*)["']/g;

const SLOT_NODE_REGEX = /<(!--slot--|[\/!]|[\w-]+)((?:\s*[\w-:]+=["'](?:[^"']*)["'])*[^\/>]*)(\/)?>/g;

const SLOT_TYPE = 'node';


const TEMPLATE = Symbol();


export {
    ATTRIBUTES,
    NODE_CLOSING,
    NODE_COMMENT,
    NODE_ELEMENT,
    NODE_SLOT,
    NODE_TYPES,
    NODE_VOID,
    SLOT,
    SLOT_ATTRIBUTE_REGEX,
    SLOT_HTML,
    SLOT_NODE_REGEX,
    SLOT_TYPE,
    TEMPLATE
};