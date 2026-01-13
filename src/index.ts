import { CLEANUP, STORE } from './constants';


// Pre-allocate on Node prototype to optimize property access
if (typeof Node !== 'undefined') {
    (Node.prototype as any)[CLEANUP] = null;
    (Node.prototype as any)[STORE] = null;
}


export * from './attributes';
export * from './event';
export * from './utilities';

export { default as html } from './html';
export { default as render } from './render';
export { default as slot, ArraySlot, EffectSlot } from './slot';
export { default as svg } from './svg';
export type { Attributes, Element, Renderable } from './types';