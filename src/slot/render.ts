import { isArray } from '@esportsplus/utilities';
import {
    EMPTY_FRAGMENT,
    RENDERABLE,
    RENDERABLE_ARRAY, RENDERABLE_FRAGMENT, RENDERABLE_HTML_FRAGMENT, RENDERABLE_HTML_REACTIVE_ARRAY,
    RENDERABLE_NODE, RENDERABLE_NODE_LIST, RENDERABLE_TEXT, RENDERABLE_VOID
} from '~/constants';
import { Element, Fragment, RenderableReactive, RenderableTemplate } from '~/types';
import { cloneNode } from '~/utilities/node';
import { append } from '~/utilities/fragment';
import text from '~/utilities/text';
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

    // Document Fragment
    if (nodeType === 11) {
        return RENDERABLE_FRAGMENT;
    }

    if (nodeType !== undefined) {
        return RENDERABLE_NODE;
    }

    if (input instanceof NodeList) {
        return RENDERABLE_NODE_LIST;
    }

    return RENDERABLE_TEXT;
}

function loop(fragment: Node, input: unknown) {
    let t = type(input);

    switch (t) {
        case RENDERABLE_HTML_REACTIVE_ARRAY:
            throw new Error('@esportsplus/template: reactive arrays cannot be defined within an slot array value');

        case RENDERABLE_VOID:
            return;

        case RENDERABLE_ARRAY:
            for (let i = 0, n = (input as unknown[]).length; i < n; i++) {
                loop(fragment, (input as unknown[])[i])
            }
            return;

        case RENDERABLE_NODE_LIST:
            append.call(fragment, ...input as Element[]);
            return;

        default:
            append.call(fragment, input as Element)
            return;
    }
}

let scratchpad = cloneNode.call(EMPTY_FRAGMENT);


export default function render(anchor: Element, input: unknown): Node {
    let fragment = scratchpad,
        t = type(input);

    switch (t) {
        case RENDERABLE_VOID:
            break;

        case RENDERABLE_TEXT:
            append.call(fragment, text(input as string));
            break;

        case RENDERABLE_HTML_FRAGMENT:
            return (input as RenderableTemplate).fragment;

        case RENDERABLE_HTML_REACTIVE_ARRAY:
            return reactive(anchor, input as RenderableReactive);

        case RENDERABLE_ARRAY:
            for (let i = 0, n = (input as unknown[]).length; i < n; i++) {
                loop(fragment, (input as unknown[])[i]);
            }

            break;

        case RENDERABLE_FRAGMENT:
            return input as Fragment;

        case RENDERABLE_NODE:
            append.call(fragment, input as Element);
            break;

        case RENDERABLE_NODE_LIST:
            append.call(fragment, ...input as Element[]);
            break;
    }

    return fragment;
};