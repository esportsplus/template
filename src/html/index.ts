import { ReactiveArray } from '@esportsplus/reactivity';
import { RENDERABLE, RENDERABLE_HTML_REACTIVE_ARRAY } from '~/constants';
import { Attributes, Renderable, RenderableReactive } from '~/types';
import { cloneNode } from '~/utilities/node';
import parser from './parser';


type Values<T = unknown> = Attributes | Attributes[] | Readonly<Attributes> | Readonly<Attributes[]> | Renderable<T>;


const html = (literals: TemplateStringsArray, ...values: (Values | Values[])[]) => {
    let { fragment, slots } = parser.parse(literals),
        clone = cloneNode.call(fragment, true);

    if (slots !== null) {
        let node, nodePath; // , parent, parentPath;

        // TODO: when a new slot is added it breaks pathfinding for the next slot
        // for (let i = 0, n = slots.length; i < n; i++) {
        for (let i = slots.length - 1; i >= 0; i--) {
            let { fn, path, slot } = slots[i];

            //     pp = path.parent,
            //     pr = path.relative;

            // if (pp !== parentPath) {
            //     if (pp === nodePath) {
            //         parent = node;
            //         parentPath = nodePath;

            //         nodePath = undefined;
            //     }
            //     else {
            //         parent = clone;
            //         parentPath = pp;

            //         for (let i = 0, n = pp.length; i < n; i++) {
            //             parent = pp[i].call(parent);
            //         }
            //     }
            // }

            // if (pr !== nodePath) {
            //     node = parent;
            //     nodePath = path.absolute;

            //     for (let i = 0, n = pr.length; i < n; i++) {
            //         node = pr[i].call(node);
            //     }
            // }

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

html.reactive = <T>(array: ReactiveArray<T[]>, template: RenderableReactive['template']): RenderableReactive => {
    return {
        [RENDERABLE]: RENDERABLE_HTML_REACTIVE_ARRAY,
        array,
        template
    };
};


export default html;