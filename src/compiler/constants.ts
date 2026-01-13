import { uid } from '@esportsplus/typescript/compiler';


const ENTRYPOINT = 'html';

const ENTRYPOINT_REACTIVITY = 'reactive';

const NAMESPACE = uid('template');


const enum TYPES {
    ArraySlot = 'array-slot',
    Attributes = 'attributes',
    Attribute = 'attribute',
    DocumentFragment = 'document-fragment',
    Effect = 'effect',
    Node = 'node',
    Primitive = 'primitive',
    Static = 'static',
    Unknown = 'unknown'
};


export { ENTRYPOINT, ENTRYPOINT_REACTIVITY, NAMESPACE, TYPES };
export { PACKAGE_NAME } from '~/constants';