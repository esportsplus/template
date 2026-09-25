import { Reactive } from '@esportsplus/reactivity';
import { UNCOMPILED } from './constants';
import { Attribute, Attributes, Renderable } from './types';
import { ArraySlot } from './slot';
import type { VirtualOptions, VirtualSlot } from './virtual';


type Values<T> = ArraySlot<T extends unknown[] ? T : never> | Attribute | Attributes | Renderable<T>;


// Built without module-level side effects (a pure call, not property assignments) so a bundle
// drops the runtime whenever nothing calls it: compiled code never does, which is what lets the
// build reject any chunk that still contains it
const html = /* @__PURE__ */ Object.assign(
    <T>(_literals: TemplateStringsArray, ..._values: (Values<T> | Values<T>[])[]): DocumentFragment => {
        throw new Error(`html\`\` templates ${UNCOMPILED}`);
    },
    {
        // The callback body is authored as html`` templates, which the compiler rewrites into
        // template() calls returning DocumentFragment | Text (a single text child emits a Text node),
        // so the callback's post-compile return type is DocumentFragment | Text — not DocumentFragment.
        reactive: <T>(_arr: Reactive<T[]>, _template: (value: T) => DocumentFragment | Text): ArraySlot<T[]> => {
            throw new Error(`html.reactive() ${UNCOMPILED}`);
        },
        virtual: <T>(_array: Reactive<T[]>, _template: (value: T) => DocumentFragment | Text, _options?: VirtualOptions): VirtualSlot<T> => {
            throw new Error(`html.virtual() ${UNCOMPILED}`);
        }
    }
);


export default html;
