import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_HTML_REACTIVE_ARRAY } from '~/constants';
import { Attributes, Renderable, RenderableReactive } from '~/types';
import { cloneNode } from '~/utilities/node';
import parser from './parser';


type Values<T> = Attributes<any> | Renderable<T>;


const html = <T>(literals: TemplateStringsArray, ...values: (Values<T> | Values<T>[])[]) => {
    let { fragment, slots } = parser.parse(literals),
        clone = cloneNode.call(fragment, true);

    if (slots !== null) {
        let node, nodePath;

        for (let i = slots.length - 1; i >= 0; i--) {
            let { fn, path, slot } = slots[i];

            if (nodePath !== path) {
                node = clone;

                for (let i = 0, n = path.length; i < n; i++) {
                    node = path[i].call(node);
                }
            }

            // @ts-ignore
            fn(node, values[slot]);
        }
    }

    return clone;
};

html.reactive = <T>(array: ReactiveArray<T>, template: RenderableReactive<T>['template']): RenderableReactive<T> => {
    return {
        [RENDERABLE]: RENDERABLE_HTML_REACTIVE_ARRAY,
        array,
        template
    };
};


export default html;