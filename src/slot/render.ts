import { isArray } from '@esportsplus/utilities';
import { ARRAY_SLOT } from '../constants';
import { clone, EMPTY_FRAGMENT, text } from '../utilities';
import { ArraySlot } from './array';


export default function render(value: unknown): Node {
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
            return render((value as any)[0]);
        }
    }

    if (isArray(value)) {
        let fragment = clone(EMPTY_FRAGMENT) as DocumentFragment;

        for (let i = 0; i < n; i++) {
            fragment.append(render(value[i]));
        }

        return fragment;
    }

    if (value instanceof NodeList) {
        let fragment = clone(EMPTY_FRAGMENT) as DocumentFragment;

        for (let i = 0; i < n; i++) {
            fragment.append(value[i]);
        }

        return fragment;
    }

    return text(value as any);
};
