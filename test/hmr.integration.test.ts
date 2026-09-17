import { effect, onCleanup, read, signal, write } from '@esportsplus/reactivity';
import { beforeEach, describe, expect, it } from 'vitest';
import { accept, dispose, factory } from '../src/hmr';
import { delegate } from '../src/event';
import { template } from '../src/utilities';
import type { Element } from '../src/types';


function commentCount(container: HTMLElement): number {
    let walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT),
        count = 0;

    while (walker.nextNode() !== null) {
        count++;
    }

    return count;
}


describe('hmr/integration', () => {
    let cleanups = 0,
        clicks = 0,
        container: HTMLElement,
        version = 0;

    const component = (label: string) => {
        let count = signal(0),
            root = template('<div><span class="label"></span><button class="btn">+</button><span class="count"></span></div>')(),
            button = root.querySelector('.btn') as Element,
            countElement = root.querySelector('.count') as Element,
            labelElement = root.querySelector('.label') as Element;

        labelElement.textContent = label + ' v' + version;
        countElement.textContent = '0';

        delegate(button, 'click', () => {
            clicks++;
            write(count, read(count) + 1);
        });

        effect(() => {
            countElement.textContent = String(read(count));
        });

        onCleanup(() => {
            cleanups++;
        });

        return root;
    };

    beforeEach(() => {
        cleanups = 0;
        clicks = 0;
        container = document.createElement('div');
        version = 0;
        document.body.appendChild(container);
    });

    it('remounts live instances in place across ten revisions without leaking', () => {
        let wrapper = factory('integration', 'default', () => component),
            fragment = wrapper('revision-0');

        container.appendChild(fragment);

        expect(container.querySelector('.label')!.textContent).toBe('revision-0 v0');
        expect(container.querySelector('.count')!.textContent).toBe('0');

        let anchors = [
                container.childNodes[0] as Comment,
                container.childNodes[container.childNodes.length - 1] as Comment
            ];

        expect(anchors[0].nodeType).toBe(Node.COMMENT_NODE);
        expect(anchors[1].nodeType).toBe(Node.COMMENT_NODE);
        expect(commentCount(container)).toBe(2);

        for (let i = 1; i <= 10; i++) {
            version = i;
            dispose('integration');

            let next = factory('integration', 'default', () => component);

            expect(next).toBe(wrapper);
            expect(accept('integration')).toBe(true);
            expect(container.querySelector('.label')!.textContent).toBe('revision-0 v' + i);
        }

        expect(commentCount(container)).toBe(2);
        expect(container.childNodes[0]).toBe(anchors[0]);
        expect(container.childNodes[container.childNodes.length - 1]).toBe(anchors[1]);
        expect(cleanups).toBe(10);

        let button = container.querySelector('.btn') as Element;

        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(clicks).toBe(1);
    });

    it('disposes the old reactive root so stale effects stop running', () => {
        let wrapper = factory('integration-effects', 'default', () => component);

        container.appendChild(wrapper('before'));

        let oldCount = container.querySelector('.count') as Element;

        expect(oldCount.textContent).toBe('0');

        dispose('integration-effects');
        factory('integration-effects', 'default', () => component);
        accept('integration-effects');

        let current = container.querySelector('.count') as Element;

        expect(current).not.toBe(oldCount);
        expect(cleanups).toBe(1);
    });
});
