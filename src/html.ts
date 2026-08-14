import { Reactive } from '@esportsplus/reactivity';
import { Attribute, Attributes, Renderable } from './types';
import { ArraySlot } from './slot';


type Values<T> = ArraySlot<T extends unknown[] ? T : never> | Attribute | Attributes<any> | Renderable<T>;


const html = <T>(_literals: TemplateStringsArray, ..._values: (Values<T> | Values<T>[])[]): DocumentFragment => {
    throw new Error('html`` templates must be compiled. Ensure vite-plugin is configured.');
};

// The callback body is authored as html`` templates, which the compiler rewrites into
// template() calls returning DocumentFragment | Text (a single text child emits a Text node),
// so the callback's post-compile return type is DocumentFragment | Text — not DocumentFragment.
html.reactive = <T>(_arr: Reactive<T[]>, _template: (value: T) => DocumentFragment | Text): ArraySlot<T[]> => {
    throw new Error('html.reactive() must be compiled. Ensure vite-plugin is configured.');
};


export default html;
