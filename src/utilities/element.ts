let getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor,
    prototype = Element.prototype;


const addEventListener = prototype.addEventListener;

const className = getOwnPropertyDescriptor(prototype, 'className')!.set!;

const innerHTML = getOwnPropertyDescriptor(prototype, 'innerHTML')!.set!;

const firstElementChild = getOwnPropertyDescriptor(prototype, 'firstElementChild')!.get!;

const nextElementSibling = getOwnPropertyDescriptor(prototype, 'nextElementSibling')!.get!;

const removeAttribute = prototype.removeAttribute;

const setAttribute = prototype.setAttribute;


export {
    addEventListener,
    className,
    innerHTML,
    firstElementChild,
    nextElementSibling,
    removeAttribute,
    setAttribute
};