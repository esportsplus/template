const NODE_CLOSING = 0;

const NODE_COMMENT = 1;

const NODE_ELEMENT = 2;

const NODE_SLOT = 3;

const NODE_VOID = 4;


const REGEX_SLOT_ATTRIBUTES = /([\w-:]+)=["']([^"']*<!--slot-->[^"']*)["']/g;

const REGEX_SLOT_TAGS = /<([\/!])?([\w-]+)((?:\s*[\w-:]+=["'][^>]*?["'])*[^\/>]*)(\/)?>/g;

const REGEX_TAG_WHITESPACE = />\s*</g;

const REGEX_WHITESPACE = /\s\s+/g;


const SLOT = '<!--slot-->';

const SLOT_TYPE_NODE = 'node';


const TEMPLATE = Symbol();


export {
    NODE_CLOSING,
    NODE_COMMENT,
    NODE_ELEMENT,
    NODE_SLOT,
    NODE_VOID,
    REGEX_WHITESPACE,
    REGEX_SLOT_ATTRIBUTES,
    REGEX_SLOT_TAGS,
    REGEX_TAG_WHITESPACE,
    SLOT,
    SLOT_TYPE_NODE,
    TEMPLATE
};