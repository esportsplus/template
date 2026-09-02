import { ANCHOR_MARKER } from '../constants';
import { Element, Renderable } from '../types';
import { EffectSlot } from './effect';
import render from './render';


export default <T>(anchor: Element, renderable: Renderable<T>, mode: number = ANCHOR_MARKER) => {
    if (typeof renderable === 'function') {
        new EffectSlot(anchor, renderable, mode);
    }
    else {
        let node = render(renderable);

        if (mode === ANCHOR_MARKER) {
            anchor.after(node);
        }
        else {
            anchor.appendChild(node);
        }
    }
};
export * from './array';
export * from './cleanup';
export * from './effect';
export { default as render } from './render';