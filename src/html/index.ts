import { ReactiveArray } from '@esportsplus/reactivity';
import { Primitive } from '@esportsplus/utilities';
import { RENDERABLE, RENDERABLE_REACTIVE, RENDERABLE_TEMPLATE } from '~/constants';
import { Attributes, Effect, Renderable, RenderableReactive, RenderableTemplate } from '~/types';
import hydrate from './hydrate';


type Values = Attributes | Effect | Primitive | Renderable | Values[];


const html = (literals: TemplateStringsArray, ...values: Values[]): RenderableTemplate => {
    return { [RENDERABLE]: RENDERABLE_TEMPLATE, literals, template: null, values };
};

html.reactive = <T>(array: ReactiveArray<T>, template: RenderableReactive<T>['template']): RenderableReactive<T> => {
    return { [RENDERABLE]: RENDERABLE_REACTIVE, literals: null, template, values: array };
};


export default html;
export { hydrate };