import { isArray } from '@esportsplus/utilities';
import { ARRAY_SLOT, EMPTY_FRAGMENT } from '~/constants';
import { Element } from '~/types';
import { cloneNode, lastChild } from '~/utilities/node';
import { append } from '~/utilities/fragment';
import { ArraySlot } from './array';
import text from '~/utilities/text';


export default function render(anchor: Element, value: unknown): Node {
    if (value == null || value === false || value === '') {
        return EMPTY_FRAGMENT;
    }

    if (typeof value !== 'object') {
        return text(value as any);
    }

    if ((value as any)[ARRAY_SLOT] === true) {
        return (value as ArraySlot<unknown>).fragment;
    }

    if ((value as any).nodeType !== undefined) {
        return value as Node;
    }

    let n = (value as any).length;

    if (typeof n === 'number') {
        if (n === 0) {
            return EMPTY_FRAGMENT;
        }
        else if (n === 1) {
            return render(anchor, (value as any)[0]);
        }
    }

    if (isArray(value)) {
        let fragment = cloneNode.call(EMPTY_FRAGMENT);

        for (let i = 0; i < n; i++) {
            append.call(fragment, render(anchor, value[i]));
            anchor = lastChild.call(fragment);
        }

        return fragment;
    }

    if (value instanceof NodeList) {
        let fragment = cloneNode.call(EMPTY_FRAGMENT);

        for (let i = 0; i < n; i++) {
            append.call(fragment, value[i]);
        }

        return fragment;
    }

    return text(value as any);
};