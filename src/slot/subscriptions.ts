import type { Reactive } from '@esportsplus/reactivity';


type ArrayEvent = 'clear' | 'concat' | 'pop' | 'push' | 'reverse' | 'set' | 'shift' | 'sort' | 'splice' | 'unshift';

type Listener = (value: any) => void;

type Subscribable = {
    on(event: string, listener: Listener): void;
};

type Broker = {
    dispatcher: Listener;
    subscribers: Set<Listener>;
};


let brokers = new WeakMap<object, Map<string, Broker>>();


const subscribeArray = <T>(array: Reactive<T[]>, event: ArrayEvent, listener: Listener): VoidFunction => {
    let byEvent = brokers.get(array);

    if (!byEvent) {
        byEvent = new Map();
        brokers.set(array, byEvent);
    }

    let entry = byEvent.get(event);

    if (!entry) {
        let subscribers = new Set<Listener>();

        entry = {
            dispatcher: (value) => {
                let errors: unknown[] = [];

                for (let subscriber of subscribers) {
                    try {
                        subscriber(value);
                    }
                    catch (e) {
                        errors.push(e);
                    }
                }

                if (errors.length) {
                    queueMicrotask(() => {
                        throw errors.length === 1
                            ? errors[0]
                            : new AggregateError(errors, '@esportsplus/template: array subscription produced multiple errors');
                    });
                }
            },
            subscribers
        };

        (array as unknown as Subscribable).on(event, entry.dispatcher);
        byEvent.set(event, entry);
    }

    entry.subscribers.add(listener);

    return () => {
        entry!.subscribers.delete(listener);
    };
};


export { subscribeArray };
