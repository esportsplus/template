import { Elements, Template } from '~/types';
import { parse } from './html';


export default (data: Template) => {
    let { expressions, html, slots } = parse(data),
        template = document.createElement('template');

    if (html) {
        template.innerHTML = html;
        template.normalize();
    }

    return {
        get nodes() {
            return Array.from(
                template.content.cloneNode(true).childNodes
            ) as Elements;
        },

        expressions,
        html,
        slots
    };
};