import { micro as m, raf as r } from '@esportsplus/tasks';
import { Element as E } from './types';


let prototype,
    template = document.createElement('template'),
    t = document.createTextNode('');


// https://github.com/localvoid/ivi/blob/master/packages/ivi/src/client/core.ts#L38
prototype = Element.prototype;

const addEventListener = prototype.addEventListener;

const append = prototype.append;

const removeEventListener = prototype.removeEventListener;

const className = Object.getOwnPropertyDescriptor(prototype, 'className')!.set!;

const innerHTML = Object.getOwnPropertyDescriptor(prototype, 'innerHTML')!.set!;

const firstElementChild = Object.getOwnPropertyDescriptor(prototype, 'firstElementChild')!.get!;

const nextElementSibling = Object.getOwnPropertyDescriptor(prototype, 'nextElementSibling')!.get!;

const prepend = prototype.prepend;

const removeAttribute = prototype.removeAttribute;

const setAttribute = prototype.setAttribute;


prototype = Node.prototype;

const cloneNode = prototype.cloneNode;

const firstChild = Object.getOwnPropertyDescriptor(prototype, 'firstChild')!.get!;

const nextSibling = Object.getOwnPropertyDescriptor(prototype, 'nextSibling')!.get!;

const nodeValue = Object.getOwnPropertyDescriptor(prototype, 'nodeValue')!.set!;

const parentElement = Object.getOwnPropertyDescriptor(prototype, 'parentElement')!.get!;

const parentNode = Object.getOwnPropertyDescriptor(prototype, 'parentNode')!.get!;


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
    microtask,
    nextElementSibling, nextSibling, nodeValue,
    parentElement, parentNode, prepend,
    raf, removeAttribute, removeEventListener,
    setAttribute,
    text
};