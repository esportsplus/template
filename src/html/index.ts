import { SLOT, TEMPLATE } from '~/constants';
import { Template } from '~/types';
import analyze from './analyze';


let { isArray } = Array;


function flatten(data: Template, value: unknown) {
    if (value === false || value == null) {
        return;
    }

    if (typeof value === 'number') {
        data.content += value;
    }
    else if (typeof value === 'object') {
        if (TEMPLATE in value) {
            let { content, expressions } = value as Template;

            if (content) {
                data.content += content;
            }

            if (expressions) {
                if (!data.expressions) {
                    data.expressions = expressions;
                }
                else {
                    for (let i = 0, n = expressions.length; i < n; i++) {
                        data.expressions.push(expressions[i]);
                    }
                }
            }
        }
        else if (isArray(value)) {
            for (let i = 0, n = value.length; i < n; i++) {
                flatten(data, value[i]);
            }
        }
        else {
            throw new Error(`Template: objects must be templates or arrays ${JSON.stringify(value)}`);
        }
    }
    // Attempting to shorten render process without sanitizing values
    // - If value is missing characters required to perform XSS attacks, add to content ( multiple indexOf faster than regex )
    // - else follow expression render steps [ analyze -> slot -> attribute | textContent ]
    else if (typeof value === 'string' && value.indexOf('<') === -1 && value.indexOf('(') === -1 && value.indexOf('&') === -1) {
        data.content += value;
    }
    else {
        data.content += SLOT;

        if (!data.expressions) {
            data.expressions = [value];
        }
        else {
            data.expressions.push(value);
        }
    }
}


export default (literals: TemplateStringsArray, ...values: unknown[]) => {
    let data: Template = {
            [TEMPLATE]: true,
            content: ''
        };

    for (let i = 0, n = literals.length; i < n; i++) {
        data.content += literals[i] || '';
        flatten(data, values[i]);
    }

    return data;
};
export { analyze };