import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_REACTIVE, RENDERABLE_TEMPLATE } from '~/constants';
import { RenderableReactive, RenderableTemplate } from '~/types';
import hydrate from './hydrate';


const html = <T>(literals: TemplateStringsArray, ...values: RenderableTemplate<T>['values']): RenderableTemplate<T> => {
    return { [RENDERABLE]: RENDERABLE_TEMPLATE, literals, template: null, values };
};

html.reactive = <T>(array: ReactiveArray<T>, template: RenderableReactive<T>['template']): RenderableReactive<T> => {
    return { [RENDERABLE]: RENDERABLE_REACTIVE, literals: null, template, values: array };
};


export default html;
export { hydrate };