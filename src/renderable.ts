import { Template } from '~/types';
import { template } from '~/dom';
import { analyze } from './html';


export default (data: Template) => {
    let { html, slots } = analyze(data),
        nodes = template(html);

    return {
        get nodes() {
            return nodes();
        },

        html,
        expressions: data.expressions,
        slots
    };
};