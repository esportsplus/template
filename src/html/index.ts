import { SLOT_HTML, TEMPLATE } from '~/constants';
import { Template } from '~/types';
import { isArray } from '~/utilities';


function flatten(template: Template, value: any) {
    if (value === '' || value === false || value == null) {
        return;
    }

    if (typeof value === 'object') {
        if (TEMPLATE in value) {
            if (value.expressions) {
                let bucket = (template.expressions || (template.expressions = [])),
                    expressions = value.expressions;

                for (let i = 0, n = expressions.length; i < n; i++) {
                    bucket.push(expressions[i]);
                }
            }

            if (value.html) {
                template.html += value.html;
            }

            return;
        }
        else if (isArray(value)) {
            for (let i = 0, n = value.length; i < n; i++) {
                flatten(template, value[i]);
            }
            return;
        }
    }

    (template.expressions || (template.expressions = [])).push(value);
    template.html += SLOT_HTML;
}


const html = (literals: TemplateStringsArray | string[], ...values: unknown[]): Template => {
    let template = html.const('');

    for (let i = 0, n = literals.length; i < n; i++) {
        template.html += literals[i];
        flatten(template, values[i]);
    }

    return template;
};

html.const = (html: string): Template => {
    return {
        [TEMPLATE]: true,
        html
    };
};

html.slot = (values: unknown[]) => {
    let template = html.const('');

    for (let i = 0, n = values.length; i < n; i++) {
        flatten(template, values[i]);
    }

    template.html = SLOT_HTML;

    return template;
};


export default html;
export { default as parse } from './parse';