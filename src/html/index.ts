import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_HTML_FRAGMENT, RENDERABLE_HTML_REACTIVE_ARRAY } from '~/constants';
import { RenderableReactive, RenderableTemplate, RenderableValues } from '~/types';
import hydrate from './hydrate';
import cache from './cache';


const html = (literals: TemplateStringsArray, ...values: RenderableValues[]): RenderableTemplate => {
    return {
        [RENDERABLE]: RENDERABLE_HTML_FRAGMENT,
        fragment: hydrate(cache.get(literals), values),
        literals
    };
};

html.reactive = <T>(array: ReactiveArray<T[]>, template: RenderableReactive['template']) => {
    return {
        [RENDERABLE]: RENDERABLE_HTML_REACTIVE_ARRAY,
        array,
        template
    };
};


export default html;