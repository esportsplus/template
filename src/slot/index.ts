import { Element } from '~/types';
import effect from './effect';
import render from './render';


export default (anchor: Element, value: unknown): void => {
    if (typeof value === 'function') {
        return effect(anchor, value as Function);
    }

    anchor.after(render(anchor, value));
};