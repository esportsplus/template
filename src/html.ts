import { Reactive } from '@esportsplus/reactivity';
import { Attribute, Attributes, Renderable } from './types';
import { ArraySlot } from './slot';


type Values<T> = ArraySlot<T extends unknown[] ? T : never> | Attribute | Attributes<any> | Renderable<T>;


const html = <T>(_literals: TemplateStringsArray, ..._values: (Values<T> | Values<T>[])[]): DocumentFragment => {
    throw new Error('html`` templates must be compiled. Ensure vite-plugin is configured.');
};

html.reactive = <T>(_arr: Reactive<T[]>, _template: (value: T) => DocumentFragment): ArraySlot<T[]> => {
    throw new Error('html.reactive() must be compiled. Ensure vite-plugin is configured.');
};


export default html;
