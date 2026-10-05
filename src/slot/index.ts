import { ANCHOR_MARKER } from '../constants';
import { Element, Renderable } from '../types';
import { adopt, context } from './cleanup';
import { EffectSlot } from './effect';
import render from './render';


export default <T>(anchor: Element, renderable: Renderable<T>, mode: number = ANCHOR_MARKER) => {
    if (typeof renderable === 'function') {
        new EffectSlot(anchor, renderable, mode);
    }
    else {
        let node = render(renderable);

        // Built outside any owner, it is owned by the slot's; with no owner here it waits for one that inserts it
        if (context() !== null) {
            adopt(node);
        }

        if (mode === ANCHOR_MARKER) {
            anchor.after(node);
        }
        else {
            anchor.appendChild(node);
        }
    }
};
export * from './array';
export * from './effect';
export { default as render } from './render';
