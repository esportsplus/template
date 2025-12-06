import { isArray } from '@esportsplus/utilities';
import { EMPTY_FRAGMENT, RENDERABLE } from '~/constants';
import { Element, RenderableReactive } from '~/types';
import { cloneNode, lastChild } from '~/utilities/node';
import { append } from '~/utilities/fragment';
import text from '~/utilities/text';
import array from './array';


export default function render(anchor: Element, value: unknown): Node {
    if (value == null || value === false || value === '') {
        return EMPTY_FRAGMENT;
    }

    if (typeof value !== 'object') {
        return text(value as any);
    }

    if (RENDERABLE in value) {
        return array(anchor, value as RenderableReactive<unknown>);
    }

    if ('nodeType' in value) {
        return value as Node;
    }

    if (isArray(value)) {
        let fragment = cloneNode.call(EMPTY_FRAGMENT);

        for (let i = 0, n = (value as unknown[]).length; i < n; i++) {
            append.call(fragment, render(anchor, (value as unknown[])[i]));
            anchor = lastChild.call(fragment);
        }

        return fragment;
    }

    if (value instanceof NodeList) {
        let fragment = cloneNode.call(EMPTY_FRAGMENT);

        for (let i = 0, n = value.length; i < n; i++) {
            append.call(fragment, value[i]);
        }

        return fragment;
    }

    return text(value as any);
};