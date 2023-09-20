import { SLOT_HTML } from './constants';


const isArray = Array.isArray;

const toString = (value: unknown) => {
    if (value == null) {
        return '';
    }

    value = value?.toString() || '';

    if (value === '' || value === SLOT_HTML || value === 'false' || value === 'NaN' || value === 'null' || value === 'undefined') {
        return '';
    }

    return value as string;
};


export { isArray, toString };