import { Attributes, Element } from '../types';
import connect from './onconnect';


// Ticks run just before each frame paints: the tick that first finds the element connected is in the frame that
// paints it, so the next one comes after that paint
export default (element: Element, listener: NonNullable<Attributes['onfirstpaint']>) => {
    connect(element, listener, 1);
};
