import marker from './marker';
import template from './template';


let cache = new WeakMap();


function flatten(data, value) {
    if (value === null) {
    }
    else if (Array.isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            flatten(data, value[i]);
        }
    }
    else if (typeof value === 'object' && value.type === 'html') {
        data.content += value.content;

        for (let i = 0, n = value.values.length; i < n; i++) {
            data.values.push(value.values[i]);
        }
    }
    else if (['function', 'object'].includes(typeof value)) {
        data.content += marker.text;
        data.values.push(value);
    }
    else if (!['null', 'undefined'].includes(`${value}`)) {
        data.content += value;
    }
}


export default (literals, ...values) => {
    let data = {
            content: '',
            type: 'html',
            values: []
        };

    if (!Array.isArray(literals) && typeof literals === 'object' && literals !== null) {
        for (let key in values) {
            data.content += ` ${key}='${marker.text}'`;
            data.values.push(values[key]);
        }

        return data;
    }

    if (template.i) {
        data.content = cache.get(literals) || '';
        data.values = values;

        if (!data.content) {
            for (let i = 0, n = literals.length; i < n; i++) {
                data.content += (i > 0 ? marker.text : '') + literals[i];
            }

            cache.set(literals, data.content);
        }
    }
    else {
        for (let i = 0, n = literals.length; i < n; i++) {
            data.content += literals[i];
            flatten(data, values[i]);
        }
    }

    return data;
};
