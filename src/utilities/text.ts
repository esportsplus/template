import { cloneNode, nodeValue } from './node';
import { Element } from '~/types';


let text = document.createTextNode('');


export default (value: string) => {
    let element = cloneNode.call(text);

    if (value !== '') {
        nodeValue.call(element, value);
    }

    return element as Element;
};