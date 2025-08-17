let getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor,
    prototype = Node.prototype;


const appendChild = prototype.appendChild;

const cloneNode = prototype.cloneNode;

const firstChild = getOwnPropertyDescriptor(prototype, 'firstChild')!.get!;

const lastChild = getOwnPropertyDescriptor(prototype, 'lastChild')!.get!;

const nextSibling = getOwnPropertyDescriptor(prototype, 'nextSibling')!.get!;

const nodeValue = getOwnPropertyDescriptor(prototype, 'nodeValue')!.set!;

const parentElement = getOwnPropertyDescriptor(prototype, 'parentElement')!.get!;

const previousSibling = getOwnPropertyDescriptor(prototype, 'previousSibling')!.get!;


export {
    appendChild,
    cloneNode,
    firstChild,
    lastChild,
    nextSibling, nodeValue,
    parentElement, previousSibling
};