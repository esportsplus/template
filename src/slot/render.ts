import { isArray } from '@esportsplus/utilities';
import {
    RENDERABLE,
    RENDERABLE_ARRAY, RENDERABLE_FRAGMENT, RENDERABLE_HTML_FRAGMENT, RENDERABLE_HTML_REACTIVE_ARRAY,
    RENDERABLE_NODE, RENDERABLE_NODE_LIST, RENDERABLE_TEXT, RENDERABLE_VOID
} from '~/constants';
import { Element, Fragment, RenderableReactive, RenderableTemplate } from '~/types';
import { append, text } from '~/utilities';
import reactive from './reactive';


function type(input: unknown) {
    if (input === false || input == null || input === '') {
        return RENDERABLE_VOID;
    }

    if (typeof input !== 'object') {
        return RENDERABLE_TEXT;
    }

    if (RENDERABLE in input) {
        return input[RENDERABLE];
    }

    if (isArray(input)) {
        return RENDERABLE_ARRAY;
    }

    let nodeType = (input as any).nodeType;

    if (nodeType === 11) {
        return RENDERABLE_FRAGMENT;
    }

    if (nodeType !== undefined) {
        return RENDERABLE_NODE;
    }

    if (input instanceof NodeList) {
        return RENDERABLE_NODE_LIST;
    }
}


export default function render(anchor: Element, fragment: Fragment, input: unknown) {
    let t = type(input);

    switch (t) {
        case RENDERABLE_VOID:
            return;

        case RENDERABLE_TEXT:
            append.call(fragment, text(String(input)));
            return;

        case RENDERABLE_HTML_FRAGMENT:
            append.call(fragment, (input as RenderableTemplate).fragment);
            return;

        case RENDERABLE_HTML_REACTIVE_ARRAY:
            return reactive(anchor, input as RenderableReactive);

        case RENDERABLE_ARRAY:
            for (let i = 0, n = (input as unknown[]).length; i < n; i++) {
                render(anchor, fragment, (input as unknown[])[i]);
            }
            return;

        case RENDERABLE_FRAGMENT:
            append.call(fragment, input as Fragment);
            return;

        case RENDERABLE_NODE:
            append.call(fragment, input as Node);
            return;

        case RENDERABLE_NODE_LIST:
            append.call(fragment, ...(input as NodeList));
            return;
    }
};