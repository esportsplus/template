import { Effect, ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_REACTIVE, RENDERABLE_TEMPLATE } from '~/constants';
import { Attributes, Renderable, RenderableReactive, RenderableTemplate } from '~/types';
import hydrate from './hydrate';


type Value<T> = T extends []
    ? Value<T>[]
    : T extends Record<PropertyKey, unknown>
        ? Attributes | Renderable
        : T extends Function
            ? Effect
            : any;


const html = <T>(literals: TemplateStringsArray, ...values: Value<T>[]): RenderableTemplate => {
    return { [RENDERABLE]: RENDERABLE_TEMPLATE, literals, template: null, values };
};

html.reactive = <T>(array: ReactiveArray<T>, template: RenderableReactive<T>['template']): RenderableReactive<T> => {
    return { [RENDERABLE]: RENDERABLE_REACTIVE, literals: null, template, values: array };
};


export default html;
export { hydrate };