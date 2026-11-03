import { isArray } from '@esportsplus/utilities';
import { ARRAY_SLOT } from '../constants';
import { clone, EMPTY_FRAGMENT, marker, text } from '../utilities';
import type { Element } from '../types';
import { ArraySlot } from './array';
import { EffectSlot } from './effect';


export default function render(value: unknown): Node {
    if (value == null || value === false || value === '') {
        return EMPTY_FRAGMENT;
    }

    // Functions reach here only from runtime values (array items, effect results); inline ones are compiled to slots
    if (typeof value === 'function') {
        let anchor = marker.cloneNode() as unknown as Element,
            fragment = clone(EMPTY_FRAGMENT) as DocumentFragment;

        // The slot inserts after the anchor, so the anchor needs a parent first. The closing text node keeps the slot's
        // content inside an enclosing group: content landing after the group's last node would outlive its detach.
        fragment.append(anchor, text(''));
        new EffectSlot(anchor, value as (...args: any[]) => any);

        return fragment;
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
