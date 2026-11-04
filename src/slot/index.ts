import { ANCHOR_MARKER } from '../constants';
import { Element, Renderable } from '../types';
import { adopt } from './cleanup';
import { EffectSlot, insert } from './effect';
import render from './render';


export default <T>(anchor: Element, renderable: Renderable<T>, mode: number = ANCHOR_MARKER) => {
    if (typeof renderable === 'function') {
        new EffectSlot(anchor, renderable, mode);
    }
    else {
        let node = render(renderable);

        // Built outside any owner, it is owned by the slot's
        adopt(node);
        insert(anchor, mode, node);
    }
};
export * from './array';
export * from './effect';
export { default as render } from './render';
