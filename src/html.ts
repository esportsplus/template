// HTML Stub with Type Compatibility
// This stub maintains the same type signature as the runtime html() function
// but throws if called at runtime (ensures all templates are compiled)

import { ReactiveArray } from '@esportsplus/reactivity';
import { Attribute, Attributes, Renderable } from '~/types';
import { ArraySlot } from '~/slot/array';


type Values<T> = Attribute | Attributes<any> | ArraySlot<T> | Renderable<T>;


const html = <T>(_literals: TemplateStringsArray, ..._values: (Values<T> | Values<T>[])[]): DocumentFragment => {
    throw new Error('html`` templates must be compiled. Ensure vite-plugin is configured.');
};

html.reactive = <T>(_arr: ReactiveArray<T>, _template: (value: T) => DocumentFragment): ArraySlot<T> => {
    throw new Error('html.reactive() must be compiled. Ensure vite-plugin is configured.');
};


export default html;
