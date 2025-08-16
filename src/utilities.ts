import { micro as m, raf as r } from '@esportsplus/tasks';
import { Element as E } from './types';


let getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor,
    prototype,
    template = document.createElement('template'),
    t = document.createTextNode('');


prototype = DocumentFragment.prototype;

const append = prototype.append

// https://github.com/localvoid/ivi/blob/master/packages/ivi/src/client/core.ts#L38
prototype = Element.prototype;

const addEventListener = prototype.addEventListener;

const removeEventListener = prototype.removeEventListener;

const className = getOwnPropertyDescriptor(prototype, 'className')!.set!;

const innerHTML = getOwnPropertyDescriptor(prototype, 'innerHTML')!.set!;

const firstElementChild = getOwnPropertyDescriptor(prototype, 'firstElementChild')!.get!;

const nextElementSibling = getOwnPropertyDescriptor(prototype, 'nextElementSibling')!.get!;

const removeAttribute = prototype.removeAttribute;

const setAttribute = prototype.setAttribute;


prototype = Node.prototype;

const cloneNode = prototype.cloneNode;

const firstChild = getOwnPropertyDescriptor(prototype, 'firstChild')!.get!;

const lastChild = getOwnPropertyDescriptor(prototype, 'lastChild')!.get!;

const nextSibling = getOwnPropertyDescriptor(prototype, 'nextSibling')!.get!;

const nodeValue = getOwnPropertyDescriptor(prototype, 'nodeValue')!.set!;

const parentElement = getOwnPropertyDescriptor(prototype, 'parentElement')!.get!;

const previousSibling = getOwnPropertyDescriptor(prototype, 'previousSibling')!.get!;


const fragment = (html: string) => {
    innerHTML.call(template, html);

    let { content } = template;

    template = cloneNode.call(template) as HTMLTemplateElement;

    return content;
};

const microtask = m();

const raf = r();

const text = (value: string) => {
    let element = cloneNode.call(t);

    if (value !== '') {
        nodeValue.call(element, value);
    }

    return element as E;
};


export {
    addEventListener, append,
    className, cloneNode,
    firstChild, firstElementChild, fragment,
    innerHTML,
    lastChild,
    microtask,
    nextElementSibling, nextSibling, nodeValue,
    parentElement, previousSibling,
    raf, removeAttribute, removeEventListener,
    setAttribute,
    text
};