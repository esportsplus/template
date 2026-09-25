import { uid } from '@esportsplus/typescript/compiler';


const ENTRYPOINT = 'html';

const ENTRYPOINT_REACTIVITY = 'reactive';

const ENTRYPOINT_VIRTUAL = 'virtual';

const NAMESPACE = uid('template');

const PACKAGE_REACTIVITY = '@esportsplus/reactivity';

const SIGNAL = 'signal';


const enum TYPES {
    ArraySlot = 'array-slot',
    Attributes = 'attributes',
    Attribute = 'attribute',
    DocumentFragment = 'document-fragment',
    Effect = 'effect',
    Node = 'node',
    Primitive = 'primitive',
    Static = 'static',
    Unknown = 'unknown',
    VirtualSlot = 'virtual-slot'
};

type Entrypoint = typeof ENTRYPOINT_REACTIVITY | typeof ENTRYPOINT_VIRTUAL;


const isEntrypoint = (value: string): value is Entrypoint => {
    return value === ENTRYPOINT_REACTIVITY || value === ENTRYPOINT_VIRTUAL;
};


export { ENTRYPOINT, ENTRYPOINT_REACTIVITY, ENTRYPOINT_VIRTUAL, isEntrypoint, NAMESPACE, PACKAGE_REACTIVITY, SIGNAL, TYPES };
export type { Entrypoint };
export { PACKAGE_NAME, UNCOMPILED } from '~/constants';
