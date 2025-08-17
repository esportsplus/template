import { innerHTML } from './element';
import { cloneNode } from './node';


let scratchpad = document.createElement('template');


const append = DocumentFragment.prototype.append;

const fragment = (html: string): DocumentFragment => {
    innerHTML.call(scratchpad, html);

    let content = scratchpad.content;

    scratchpad = cloneNode.call(scratchpad) as HTMLTemplateElement;

    return content;
};


export { append, fragment };