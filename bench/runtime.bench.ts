import { bench, describe } from 'vitest';


describe('attributes - apply', () => {
    let element: HTMLDivElement;

    bench('setAttribute style', () => {
        element = document.createElement('div');
        element.setAttribute('style', 'color: red; font-size: 14px; display: flex;');
    });

    bench('style.cssText', () => {
        element = document.createElement('div');
        element.style.cssText = 'color: red; font-size: 14px; display: flex;';
    });

    bench('className assignment', () => {
        element = document.createElement('div');
        element.className = 'foo bar baz qux';
    });

    bench('setAttribute class', () => {
        element = document.createElement('div');
        element.setAttribute('class', 'foo bar baz qux');
    });
});


describe('attributes - class list rebuild', () => {
    bench('Set for..of + string concat', () => {
        let set = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon']),
            result = '';

        for (let key of set) {
            result += (result ? ' ' : '') + key;
        }
    });

    bench('Array.from(set).join', () => {
        let set = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon']);

        Array.from(set).join(' ');
    });

    bench('set forEach + string concat', () => {
        let set = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon']),
            result = '';

        set.forEach(key => {
            result += (result ? ' ' : '') + key;
        });
    });
});


describe('event - defineProperty overhead', () => {
    let event: Event;

    bench('defineProperty per dispatch', () => {
        event = new Event('click');
        let node: HTMLElement | null = document.createElement('div');

        Object.defineProperty(event, 'currentTarget', {
            configurable: true,
            get() {
                return node || document;
            }
        });
    });

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
    });
});


describe('marker - comment vs text node', () => {
    let comment = document.createComment('$'),
        textNode = document.createTextNode('');

    bench('clone comment node', () => {
        comment.cloneNode();
    });

    bench('clone text node', () => {
        textNode.cloneNode();
    });
});


describe('ontick - Set iteration', () => {
    let tasks = new Set<VoidFunction>();

    for (let i = 0; i < 10; i++) {
        tasks.add(() => {});
    }

    bench('for..of Set', () => {
        for (let task of tasks) {
            task();
        }
    });

    bench('Set.forEach', () => {
        tasks.forEach(task => task());
    });
});


describe('array sync - fragment append', () => {
    let fragment: DocumentFragment,
        nodes: Node[];

    bench('individual append', () => {
        fragment = document.createDocumentFragment();
        nodes = [];

        for (let i = 0; i < 50; i++) {
            nodes.push(document.createElement('div'));
        }

        for (let i = 0, n = nodes.length; i < n; i++) {
            fragment.append(nodes[i]);
        }
    });

    bench('batch append spread', () => {
        fragment = document.createDocumentFragment();
        nodes = [];

        for (let i = 0; i < 50; i++) {
            nodes.push(document.createElement('div'));
        }

        fragment.append(...nodes);
    });
});


describe('array sort - full resync vs minimal moves', () => {
    let parent: HTMLDivElement,
        fragment: DocumentFragment;

    bench('full detach + reattach (current)', () => {
        parent = document.createElement('div');
        fragment = document.createDocumentFragment();

        for (let i = 0; i < 50; i++) {
            parent.appendChild(document.createElement('span'));
        }

        let children = Array.from(parent.children);

        // Simulate: detach all, reattach in new order
        for (let i = 0, n = children.length; i < n; i++) {
            fragment.append(children[i]);
        }

        parent.appendChild(fragment);
    });

    bench('targeted insertBefore (LIS approach)', () => {
        parent = document.createElement('div');

        for (let i = 0; i < 50; i++) {
            parent.appendChild(document.createElement('span'));
        }

        let children = Array.from(parent.children);

        // Simulate: only move 5 out of 50 elements (90% stay)
        for (let i = 0; i < 5; i++) {
            let idx = Math.floor(Math.random() * children.length);

            parent.insertBefore(children[idx], children[(idx + 10) % children.length]);
        }
    });
});


describe('fragment - dedup empty', () => {
    let tmpl = document.createElement('template');

    bench('fragment() call', () => {
        let element = tmpl.cloneNode() as HTMLTemplateElement;

        element.innerHTML = '';

        element.content;
    });

    bench('cached fragment clone', () => {
        let cached = document.createDocumentFragment();

        cached.cloneNode(true);
    });
});
