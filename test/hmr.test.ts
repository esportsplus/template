import { describe, expect, it } from 'vitest';
import { accept, callable, dispose, eager, factory, prune, revision } from '../src/hmr';


function comments(container: HTMLElement): Comment[] {
    let walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT),
        result: Comment[] = [],
        node: Node | null;

    while ((node = walker.nextNode()) !== null) {
        result.push(node as Comment);
    }

    return result;
}

// Mirrors Vite's hot-update order: dispose the old revision, re-evaluate the module (which
// re-registers its exports), then commit through the accept callback.
function update(moduleId: string, register: () => void): boolean {
    dispose(moduleId);
    register();
    return accept(moduleId);
}


describe('hmr', () => {
    describe('revision', () => {
        it('returns a token for the module', () => {
            expect(revision('revision-module')).toEqual({ moduleId: 'revision-module' });
        });
    });

    describe('accept', () => {
        it('returns false when no module is pending', () => {
            expect(accept('missing')).toBe(false);
        });
    });

    describe('eager', () => {
        it('materializes an exported node between stable comment anchors', () => {
            let fragment = eager('eager-module', 'default', () => {
                    let div = document.createElement('div');

                    div.textContent = 'old';
                    return div;
                }),
                container = document.createElement('div');

            container.appendChild(fragment);

            expect(container.textContent).toBe('old');

            let anchors = comments(container);

            expect(anchors).toHaveLength(2);
            expect(anchors[0].nodeValue).toBe('hmr');
            expect(anchors[1].nodeValue).toBe('hmr');

            let next = update('eager-module', () => {
                eager('eager-module', 'default', () => {
                    let div = document.createElement('div');

                    div.textContent = 'new';
                    return div;
                });
            });

            expect(next).toBe(true);
            expect(container.textContent).toBe('new');
            expect(comments(container)[0]).toBe(anchors[0]);
            expect(comments(container)[1]).toBe(anchors[1]);
        });

        it('re-registering returns the same fragment', () => {
            let fragment = eager('eager-identity', 'default', () => {
                    let div = document.createElement('div');

                    div.textContent = 'a';
                    return div;
                }),
                container = document.createElement('div'),
                seen: DocumentFragment | null = null;

            container.appendChild(fragment);

            let next = update('eager-identity', () => {
                seen = eager('eager-identity', 'default', () => {
                    let div = document.createElement('div');

                    div.textContent = 'b';
                    return div;
                });
            });

            expect(seen).toBe(fragment);
            expect(next).toBe(true);
            expect(container.textContent).toBe('b');
        });
    });

    describe('factory', () => {
        it('keeps the exported callable identity stable across revisions', () => {
            let component = factory('factory-module', 'default', () => function (label: string) {
                    let div = document.createElement('div');

                    div.textContent = 'old:' + label;
                    return div;
                }),
                container = document.createElement('div'),
                fragment = component('x');

            container.appendChild(fragment);

            expect(container.textContent).toBe('old:x');

            let anchors = comments(container),
                next = update('factory-module', () => {
                    let again = factory('factory-module', 'default', () => function (label: string) {
                        let div = document.createElement('div');

                        div.textContent = 'new:' + label;
                        return div;
                    });

                    expect(again).toBe(component);
                });

            expect(next).toBe(true);
            expect(container.textContent).toBe('new:x');
            expect(comments(container)[0]).toBe(anchors[0]);
            expect(comments(container)[1]).toBe(anchors[1]);
        });

        it('re-invokes live instances with their original this and args', () => {
            let received: { args: unknown[]; self: unknown }[] = [],
                make = () => function (this: unknown, a: number, b: number) {
                    received.push({ args: [a, b], self: this });
                    return document.createElement('div');
                },
                component = factory('factory-args', 'default', make),
                self = { tag: 'self' },
                container = document.createElement('div');

            container.appendChild(component.call(self, 1, 2));

            expect(received).toEqual([{ args: [1, 2], self }]);

            update('factory-args', () => {
                factory('factory-args', 'default', make);
            });

            expect(received).toHaveLength(2);
            expect(received[1]).toEqual({ args: [1, 2], self });
        });

        it('preserves arity', () => {
            let component = factory('factory-arity', 'default', () => function (a: number, b: number, c: number) {
                return document.createElement('div');
            });

            expect(component.length).toBe(3);
        });
    });

    describe('callable', () => {
        it('forwards to the current implementation and preserves this/args', () => {
            let stable = callable('callable-module', 'factory', () => function (this: any, a: number, b: number) {
                    return (this.base ?? 0) + a + b;
                }),
                self = { base: 10 };

            expect(stable.length).toBe(2);
            expect(stable.call(self, 1, 2)).toBe(13);

            update('callable-module', () => {
                let again = callable('callable-module', 'factory', () => function (this: any, a: number, b: number) {
                    return (this.base ?? 0) + a + b + 100;
                });

                expect(again).toBe(stable);
            });

            expect(stable.call(self, 1, 2)).toBe(113);
        });
    });

    describe('prune', () => {
        it('tears down live instances and removes their anchors', () => {
            let component = factory('prune-module', 'default', () => () => document.createElement('div')),
                container = document.createElement('div');

            container.appendChild(component());

            expect(container.childNodes).toHaveLength(3);

            prune('prune-module');

            expect(container.childNodes).toHaveLength(0);
        });
    });
});
