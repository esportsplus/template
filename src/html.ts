import { Reactive } from '@esportsplus/reactivity';
import { UNCOMPILED } from './constants';
import { Attribute, Attributes, Renderable } from './types';
import { ArraySlot } from './slot';
import type { VirtualOptions, VirtualSlot } from './virtual';


type Values<T> = ArraySlot<T extends unknown[] ? T : never> | Attribute | Attributes | Renderable<T>;


// Built without module-level side effects (a pure call, not property assignments) so a bundle
// drops the runtime whenever nothing calls it: compiled code never does, which is what lets the
// build reject any chunk that still contains it
// A compiled template is its one root element when it has exactly one, a Text node when it is text alone, and a
// fragment otherwise
const html = /* @__PURE__ */ Object.assign(
    <T>(_literals: TemplateStringsArray, ..._values: (Values<T> | Values<T>[])[]): DocumentFragment | Element | Text => {
        throw new Error(`html\`\` templates ${UNCOMPILED}`);
    },
    {
        reactive: <T>(_arr: Reactive<T[]>, _template: (value: T) => DocumentFragment | Element | Text): ArraySlot<T[]> => {
            throw new Error(`html.reactive() ${UNCOMPILED}`);
        },
        virtual: <T>(_array: Reactive<T[]>, _template: (value: T) => DocumentFragment | Element | Text, _options?: VirtualOptions): VirtualSlot<T> => {
            throw new Error(`html.virtual() ${UNCOMPILED}`);
        }
    }
);


export default html;
