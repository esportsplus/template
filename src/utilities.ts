import { SLOT_HTML } from './constants';


let skip = new Set<unknown>([SLOT_HTML, 'false', 'NaN', 'null', 'undefined']);


const isArray = Array.isArray;

const toString = (value: unknown) => {
    if (value == null) {
        return '';
    }

    value = value?.toString() || '';

    if (skip.has(value)) {
        return '';
    }

    return value as string;
};


export { isArray, toString };