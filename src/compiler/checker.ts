import { ts } from '@esportsplus/typescript';


type Query = (...args: unknown[]) => unknown;


// Pure queries: answers are fixed for the program snapshot a transform runs against
const CACHED = new Set<PropertyKey>([
    'getDeclaredTypeOfSymbol',
    'getReturnTypeOfSignature',
    'getShorthandAssignmentValueSymbol',
    'getSignaturesOfType',
    'getSymbolAtLocation',
    'getTypeArguments',
    'getTypeAtLocation',
    'isTypeAssignableTo',
    'resolveName'
]);


// Keyed on (first argument, second argument); a call passing more arguments (e.g. resolveName's
// optional location) is answered by the checker directly rather than risk a wrong cache hit
function memoize(query: Query): Query {
    let results = new Map<unknown, Map<unknown, unknown>>();

    return (...args) => {
        if (args.length > 2) {
            return query(...args);
        }

        let bucket = results.get(args[1]);

        if (!bucket) {
            bucket = new Map();
            results.set(args[1], bucket);
        }

        if (bucket.has(args[0])) {
            return bucket.get(args[0]);
        }

        let result = query(...args);

        bucket.set(args[0], result);

        return result;
    };
}


// Every checker query is a synchronous IPC round-trip to tsgo, and codegen asks the same
// question about the same node repeatedly (each specialized variant re-folds, re-analyzes and
// re-matches selectors). Scope one cache to one transform so no answer outlives its snapshot.
const cached = (checker: ts.Checker): ts.Checker => {
    let methods = new Map<PropertyKey, Query>();

    return new Proxy(checker, {
        get(target, key) {
            let value = Reflect.get(target, key);

            if (typeof value !== 'function') {
                return value;
            }

            let method = methods.get(key);

            if (!method) {
                method = value.bind(target) as Query;

                if (CACHED.has(key)) {
                    method = memoize(method);
                }

                methods.set(key, method);
            }

            return method;
        }
    });
};


export { cached };
