import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_HTML_REACTIVE_ARRAY } from '~/constants';
import { RenderableReactive, RenderableValue } from '~/types';
import { cloneNode } from '~/utilities/node';
import parser from './parser';


const html = (literals: TemplateStringsArray, ...values: (RenderableValue | RenderableValue[])[]): DocumentFragment => {
    let { fragment, slots } = parser.parse(literals);

    fragment = cloneNode.call(fragment, true) as DocumentFragment;

    if (slots !== null) {
        let node, nodePath, parent, parentPath;

        for (let i = 0, n = slots.length; i < n; i++) {
            let { fn, path, slot } = slots[i],
                pp = path.parent,
                pr = path.relative;

            if (pp !== parentPath) {
                if (pp === nodePath) {
                    parent = node;
                    parentPath = nodePath;

                    nodePath = undefined;
                }
                else {
                    parent = fragment;
                    parentPath = pp;

                    for (let i = 0, n = pp.length; i < n; i++) {
                        parent = pp[i].call(parent);
                    }
                }
            }

            if (pr !== nodePath) {
                node = parent;
                nodePath = path.absolute;

                for (let i = 0, n = pr.length; i < n; i++) {
                    node = pr[i].call(node);
                }
            }

            // @ts-ignore
            fn(node, values[slot]);
        }
    }

    return fragment;
};

html.reactive = <T>(array: ReactiveArray<T[]>, template: RenderableReactive['template']): RenderableReactive => {
    return {
        [RENDERABLE]: RENDERABLE_HTML_REACTIVE_ARRAY,
        array,
        template
    };
};


export default html;