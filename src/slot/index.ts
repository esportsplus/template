import { EMPTY_FRAGMENT } from '~/constants';
import { Element, Fragment } from '~/types';
import { cloneNode } from '~/utilities';
import effect from './effect';
import render from './render';


function slot(anchor: Element, input: unknown) {
    let fragment = cloneNode.call(EMPTY_FRAGMENT) as Fragment;

    render(anchor, fragment, input);

    anchor.after(fragment);
}


export default (anchor: Element, value: unknown) => {
    if (typeof value === 'function') {
        return effect(anchor, value as Function);
    }

    return slot(anchor, value);
};