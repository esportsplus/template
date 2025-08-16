import { innerHTML } from './element';
import { cloneNode } from './node';


let prototype = DocumentFragment.prototype,
    template = document.createElement('template');


const append = prototype.append;

const fragment = (html: string) => {
    innerHTML.call(template, html);

    let content = template.content;

    template = cloneNode.call(template) as HTMLTemplateElement;

    return content;
};


export { append, fragment };