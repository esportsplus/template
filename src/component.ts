import { Attributes, Renderable } from './types';
import { isObject, EMPTY_OBJECT } from '@esportsplus/utilities';


type Factory<A, C, R, P = {}> = {
    (): R;
    <T extends A>(attributes: T): R;
    <T extends C>(content: T): R;
    (attributes: A, content?: C): R;
    // Presets bind only the attributes they fix; callers supply the rest
    bind(context: { attributes?: Partial<A>, content?: C }): Factory<A, C, R, P>;
} & P;


export default <
    A extends Attributes,
    C = Renderable<any>,
    const P extends Record<PropertyKey, unknown> = {},
    Context = { attributes?: A, content?: C }
>(
    // `A` stays naked so annotated union attributes infer intact
    template: (this: Context, attributes: A, content: C) => Renderable<any>,
    properties?: P
) => {
    function factory(): ReturnType<typeof template>;
    function factory<T extends A>(attributes: T): ReturnType<typeof template>;
    function factory<T extends C>(content: T): ReturnType<typeof template>;
    function factory(attributes: A, content?: C): ReturnType<typeof template>;
    function factory(this: Context, one?: A | C, two?: C): ReturnType<typeof template> {
        if (arguments.length === 1 && !isObject(one)) {
            two = one as C;
            one = EMPTY_OBJECT as A;
        }

        return template.call(this, (one || EMPTY_OBJECT) as A, two as C);
    }

    if (properties) {
        // Bound presets keep the assigned properties; `this` is the (possibly HMR wrapped) factory
        let bind = function(this: Function, context: Context) {
                return Object.assign(Function.prototype.bind.call(this, context), properties, { bind });
            };

        Object.assign(factory, properties, { bind });
    }

    return factory as Factory<A, C, ReturnType<typeof template>, P>;
};

export type { Factory };
