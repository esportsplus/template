import { Attributes, Renderable } from './types';
import { isObject, EMPTY_OBJECT } from '@esportsplus/utilities';


export default <
    A extends Attributes,
    C extends Renderable<any> = Renderable<any>,
    Context = { attributes?: A, content?: C }
>(
    template: (this: Context, attributes: Readonly<A>, content: C) => Renderable<any>
) => {
    function factory(): ReturnType<typeof template>;
    function factory<T extends A>(attributes: T): ReturnType<typeof template>;
    function factory<T extends C>(content: T): ReturnType<typeof template>;
    function factory(attributes: A, content: C): ReturnType<typeof template>;
    function factory(this: Context, one?: A | C, two?: C): ReturnType<typeof template> {
        if (arguments.length === 1 && !isObject(one)) {
            two = one as C;
            one = EMPTY_OBJECT as A;
        }

        return template.call(this, (one || EMPTY_OBJECT) as A, two as C);
    }

    return factory;
};