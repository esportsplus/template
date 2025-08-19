import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_HTML_REACTIVE_ARRAY } from '~/constants';
import { Attribute, Attributes, Renderable, RenderableReactive } from '~/types';
import { cloneNode } from '~/utilities/node';
import parser from './parser';
import attributes from '~/attributes';
import slot from '~/slot';


type Values<T> = Attribute | Attributes<any> | Renderable<T>;


const html = <T>(literals: TemplateStringsArray, ...values: (Values<T> | Values<T>[])[]) => {
    let { fragment, slots } = parser.parse(literals),
        clone = cloneNode.call(fragment, true);

    if (slots !== null) {
        let e, p;

        for (let i = slots.length - 1; i >= 0; i--) {
            let { fn, name, path } = slots[i];

            if (p !== path) {
                e = clone;

                for (let i = 0, n = path.length; i < n; i++) {
                    e = path[i].call(e);
                }
            }

            if (name === null) {
                (fn as typeof attributes.spread | typeof slot)(e, values[i] as any);
            }
            else {
                (fn as typeof attributes.set)(e, name, values[i]);
            }
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