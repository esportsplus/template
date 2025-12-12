import { Element } from '~/types';
import { EffectSlot } from './effect';
import render from './render';


export default (anchor: Element, value: unknown): void => {
    if (typeof value === 'function') {
        new EffectSlot(anchor, value as ConstructorParameters<typeof EffectSlot>[1]);
    }
    else {
        anchor.after( render(anchor, value) );
    }
};