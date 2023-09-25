import { SLOT_HTML, TEMPLATE } from '~/constants';
import { Template } from '~/types';
import { isArray } from '~/utilities';


function flatten(template: Template, value: any) {
    if (value === '' || value === false || value == null) {
        return;
    }

    let bucket = template.expressions;

    if (typeof value === 'object') {
        if (TEMPLATE in value) {
            let { expressions, html } = value;

            if (expressions) {
                if (bucket === undefined) {
                    template.expressions = expressions;
                }
                else {
                    for (let i = 0, n = expressions.length; i < n; i++) {
                        bucket.push(expressions[i]);
                    }
                }
            }

            if (html) {
                template.html += html;
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

    if (bucket === undefined) {
        template.expressions = [value];
    }
    else {
        bucket.push(value);
    }

    template.html += SLOT_HTML;
}


const html = (html: TemplateStringsArray | string[], ...values: unknown[]): Template => {
    let template = {
            [TEMPLATE]: true,
            html: ''
        };

    for (let i = 0, n = Math.max(html.length, values.length); i < n; i++) {
        let literal = html[i];

        if (literal) {
            template.html += literal;
        }

        flatten(template, values[i]);
    }

    return template;
};

html.const = (html: string | (number | string)[]): Template => {
    if (typeof html !== 'string') {
        html = html.join('');
    }

    return {
        [TEMPLATE]: true,
        html
    };
}

html.slot = (values: unknown[]) => {
    let template = {
            [TEMPLATE]: true,
            html: ''
        };

    if (values.length === 0) {
        return template;
    }

    for (let i = 0, n = values.length; i < n; i++) {
        flatten(template, values[i]);
    }

    template.html = SLOT_HTML;

    return template;
};


export default html;
export { default as analyze } from './analyze';