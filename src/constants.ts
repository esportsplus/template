const EVENT_BAIL = 0;

const EVENT_DELEGATED = 1;

const EVENT_LISTENER = 2;


const NODE_CLOSING = 0;

const NODE_COMMENT = 1;

const NODE_ELEMENT = 2;

const NODE_SLOT = 3;

const NODE_VOID = 4;


const SLOT = Symbol();

const SLOT_HTML = '<!--slot-->';

const SLOT_ATTRIBUTE_REGEX = /([\w-:]+)=["']([^"']*<!--slot-->[^"']*)["']/g;

const SLOT_NODE_REGEX = /<([\/!])?([\w-]+)((?:\s*[\w-:]+=["'](?:[^"']*)["'])*[^\/>]*)(\/)?>/g;

const SLOT_TYPE = 'node';


const TEMPLATE = Symbol();


export {
    EVENT_BAIL,
    EVENT_DELEGATED,
    EVENT_LISTENER,
    NODE_CLOSING,
    NODE_COMMENT,
    NODE_ELEMENT,
    NODE_SLOT,
    NODE_VOID,
    SLOT,
    SLOT_ATTRIBUTE_REGEX,
    SLOT_HTML,
    SLOT_NODE_REGEX,
    SLOT_TYPE,
    TEMPLATE
};