import { Element, Renderable } from '../types';
import { EffectSlot } from './effect';
import render from './render';


export default <T>(anchor: Element, renderable: Renderable<T>) => {
    if (typeof renderable === 'function') {
        new EffectSlot(anchor, renderable);
    }
    else {
        anchor.after( render(anchor, renderable) );
    }
};
export * from './array';
export * from './cleanup';
export * from './effect';
export { default as render } from './render';