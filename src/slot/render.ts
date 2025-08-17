import { isArray } from '@esportsplus/utilities';
import { EMPTY_FRAGMENT, RENDERABLE } from '~/constants';
import { Element, RenderableReactive } from '~/types';
import { cloneNode, lastChild } from '~/utilities/node';
import { append } from '~/utilities/fragment';
import text from '~/utilities/text';
import reactive from './reactive';


export default function render(anchor: Element, input: unknown): Node {
    if (input == null || input === false || input === '') {
        return EMPTY_FRAGMENT;
    }

    if (typeof input !== 'object') {
        return text(input as any);
    }

    if ('nodeType' in input) {
        return input as Node;
    }

    if (RENDERABLE in input) {
        return reactive(anchor, input as RenderableReactive);
    }

    if (isArray(input)) {
        let fragment = cloneNode.call(EMPTY_FRAGMENT);

        for (let i = 0, n = (input as unknown[]).length; i < n; i++) {
            append.call(fragment, render(anchor, (input as unknown[])[i]));
            anchor = lastChild.call(fragment);
        }

        return fragment;
    }

    if (input instanceof NodeList) {
        let fragment = cloneNode.call(EMPTY_FRAGMENT),
            nodes = Array.from(input as NodeList);

        for (let i = 0, n = nodes.length; i < n; i++) {
            append.call(fragment, nodes[i]);
        }

        return fragment;
    }

    return text(input as any);
};