import { test } from 'vitest';


test('attributes - apply', async ({ bench }) => {
    let element: HTMLDivElement;

    await bench.compare(
        bench('setAttribute style', () => {
            element = document.createElement('div');
            element.setAttribute('style', 'color: red; font-size: 14px; display: flex;');
        }),
        bench('style.cssText', () => {
            element = document.createElement('div');
            element.style.cssText = 'color: red; font-size: 14px; display: flex;';
        }),
        bench('className assignment', () => {
            element = document.createElement('div');
            element.className = 'foo bar baz qux';
        }),
        bench('setAttribute class', () => {
            element = document.createElement('div');
            element.setAttribute('class', 'foo bar baz qux');
        })
    );
});


test('attributes - class list rebuild', async ({ bench }) => {
    await bench.compare(
        bench('Set for..of + string concat', () => {
            let result = '',
                set = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon']);

            for (let key of set) {
                result += (result ? ' ' : '') + key;
            }
        }),
        bench('Array.from(set).join', () => {
            let set = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon']);

            Array.from(set).join(' ');
        }),
        bench('set forEach + string concat', () => {
            let result = '',
                set = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon']);

            set.forEach(key => {
                result += (result ? ' ' : '') + key;
            });
        })
    );
});


test('event - defineProperty overhead', async ({ bench }) => {
    let event: Event;

    await bench.compare(
        bench('defineProperty per dispatch', () => {
            event = new Event('click');
            let node: HTMLElement | null = document.createElement('div');

            Object.defineProperty(event, 'currentTarget', {
                configurable: true,
                get() {
                    return node || document;
                }
            });
        }),
        bench('defineProperty once + closure update', () => {
            event = new Event('click');
            let currentNode: HTMLElement | null = null;

            Object.defineProperty(event, 'currentTarget', {
                configurable: true,
                get() {
                    return currentNode || document;
                }
            });

            currentNode = document.createElement('div');
        })
    );
});


test('marker - comment vs text node', async ({ bench }) => {
    let comment = document.createComment('$'),
        textNode = document.createTextNode('');

    await bench.compare(
        bench('clone comment node', () => {
            comment.cloneNode();
        }),
        bench('clone text node', () => {
            textNode.cloneNode();
        })
    );
});


test('ontick - Set iteration', async ({ bench }) => {
    let tasks = new Set<VoidFunction>();

    for (let i = 0; i < 10; i++) {
        tasks.add(() => {});
    }

    await bench.compare(
        bench('for..of Set', () => {
            for (let task of tasks) {
                task();
            }
        }),
        bench('Set.forEach', () => {
            tasks.forEach(task => task());
        })
    );
});


test('array sync - fragment append', async ({ bench }) => {
    let fragment: DocumentFragment,
        nodes: Node[];

    await bench.compare(
        bench('individual append', () => {
            fragment = document.createDocumentFragment();
            nodes = [];

            for (let i = 0; i < 50; i++) {
                nodes.push(document.createElement('div'));
            }

            for (let i = 0, n = nodes.length; i < n; i++) {
                fragment.append(nodes[i]);
            }
        }),
        bench('batch append spread', () => {
            fragment = document.createDocumentFragment();
            nodes = [];

            for (let i = 0; i < 50; i++) {
                nodes.push(document.createElement('div'));
            }

            fragment.append(...nodes);
        })
    );
});


test('array sort - full resync vs minimal moves', async ({ bench }) => {
    let fragment: DocumentFragment,
        parent: HTMLDivElement;

    await bench.compare(
        bench('full detach + reattach (current)', () => {
            parent = document.createElement('div');
            fragment = document.createDocumentFragment();

            for (let i = 0; i < 50; i++) {
                parent.appendChild(document.createElement('span'));
            }

            let children = Array.from(parent.children);

            for (let i = 0, n = children.length; i < n; i++) {
                fragment.append(children[i]);
            }

            parent.appendChild(fragment);
        }),
        bench('targeted insertBefore (LIS approach)', () => {
            parent = document.createElement('div');

            for (let i = 0; i < 50; i++) {
                parent.appendChild(document.createElement('span'));
            }

            let children = Array.from(parent.children);

            for (let i = 0; i < 5; i++) {
                let idx = Math.floor(Math.random() * children.length);

                parent.insertBefore(children[idx], children[(idx + 10) % children.length]);
            }
        })
    );
});


test('fragment - dedup empty', async ({ bench }) => {
    let tmpl = document.createElement('template');

    await bench.compare(
        bench('fragment() call', () => {
            let element = tmpl.cloneNode() as HTMLTemplateElement;

            element.innerHTML = '';

            element.content;
        }),
        bench('cached fragment clone', () => {
            let cached = document.createDocumentFragment();

            cached.cloneNode(true);
        })
    );
});
