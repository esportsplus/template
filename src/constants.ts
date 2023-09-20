const NODE_CLOSING = 0;

const NODE_COMMENT = 1;

const NODE_ELEMENT = 2;

const NODE_SLOT = 3;

const NODE_VOID = 4;


const SLOT = Symbol();

const SLOT_HTML = '<!--slot-->';

const SLOT_REGEX = /<([\/!])?([\w-]+)((?:\s*[\w-:]+=["'](?:[^"']*)["'])*[^\/>]*)(\/)?>/g;

const SLOT_TYPE = 'node';


const TEMPLATE = Symbol();


export {
    NODE_CLOSING,
    NODE_COMMENT,
    NODE_ELEMENT,
    NODE_SLOT,
    NODE_VOID,
    SLOT,
    SLOT_HTML,
    SLOT_REGEX,
    SLOT_TYPE,
    TEMPLATE
};