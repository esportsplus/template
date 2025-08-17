import { Element } from '~/types';
import effect from './effect';
import render from './render';


export default (anchor: Element, value: unknown): void => {
    if (typeof value === 'function') {
        effect(anchor, value as Function);
    }
    else {
        anchor.after( render(anchor, value) );
    }
};