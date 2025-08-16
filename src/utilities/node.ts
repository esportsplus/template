let getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor,
    prototype = Node.prototype;


const cloneNode = prototype.cloneNode;

const firstChild = getOwnPropertyDescriptor(prototype, 'firstChild')!.get!;

const lastChild = getOwnPropertyDescriptor(prototype, 'lastChild')!.get!;

const nextSibling = getOwnPropertyDescriptor(prototype, 'nextSibling')!.get!;

const nodeValue = getOwnPropertyDescriptor(prototype, 'nodeValue')!.set!;

const parentElement = getOwnPropertyDescriptor(prototype, 'parentElement')!.get!;

const previousSibling = getOwnPropertyDescriptor(prototype, 'previousSibling')!.get!;


export {
    cloneNode,
    firstChild,
    lastChild,
    nextSibling, nodeValue,
    parentElement, previousSibling
};