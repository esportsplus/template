import { innerHTML } from './element';
import { cloneNode } from './node';


let template = document.createElement('template');


const append = DocumentFragment.prototype.append;

const fragment = (html: string): DocumentFragment => {
    let element = cloneNode.call(template) as HTMLTemplateElement;

    innerHTML.call(element, html);

    return element.content;
};


export { append, fragment };