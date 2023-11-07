import { Element as E } from './types';


let prototype,
    template = document.createElement('template'),
    t = document.createTextNode('');


// https://github.com/localvoid/ivi/blob/master/packages/ivi/src/client/core.ts#L38
prototype = Element.prototype;

const addEventListener = prototype.addEventListener;

const removeEventListener = prototype.removeEventListener;

const className = Object.getOwnPropertyDescriptor(prototype, 'className')!.set! as (this: E, value: string) => void;

const innerHTML = Object.getOwnPropertyDescriptor(prototype, 'innerHTML')!.set!;

const firstElementChild = Object.getOwnPropertyDescriptor(prototype, 'firstElementChild')!.get! as (this: DocumentFragment | E) => E;

const nextElementSibling = Object.getOwnPropertyDescriptor(prototype, 'nextElementSibling')!.get! as typeof firstElementChild;

const prepend = prototype.prepend;

const removeAttribute = prototype.removeAttribute;

const setAttribute = prototype.setAttribute;


prototype = Node.prototype;

const clone = Object.getOwnPropertyDescriptor(prototype, 'cloneNode')!.value;

const firstChild = Object.getOwnPropertyDescriptor(prototype, 'firstChild')!.get as typeof firstElementChild;

const nextSibling = Object.getOwnPropertyDescriptor(prototype, 'nextSibling')!.get as typeof firstElementChild;

const nodeType = Object.getOwnPropertyDescriptor(prototype, 'nodeType')!.get!;

const nodeValue = Object.getOwnPropertyDescriptor(prototype, 'nodeValue')!.set!;


const fragment = (html: string) => {
    innerHTML.call(template, html);

    return clone(template.content, true);
};

const isArray = Array.isArray;

const text = (value: string) => {
    let element = clone(t, true);

    if (value !== '') {
        nodeValue!.call(element, value);
    }

    return element as any as E;
};


export {
    addEventListener,
    className,
    clone,
    firstChild,
    firstElementChild,
    fragment,
    innerHTML,
    isArray,
    nextElementSibling,
    nextSibling,
    nodeType,
    nodeValue,
    prepend,
    removeAttribute,
    removeEventListener,
    setAttribute,
    text
};