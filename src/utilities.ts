import { SLOT_HTML } from './constants';


let tmpl = document.createElement('template'),
    txt = document.createTextNode('');


// Firefox's importNode outperforms cloneNode in certain scenarios
const clone = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox')
    ? document.importNode.bind(document)
    : <T extends DocumentFragment | Node>(node: T, deep: boolean = true) => node.cloneNode(deep) as T;

// Create a fragment from HTML string
const fragment = (html: string): DocumentFragment => {
    let element = tmpl.cloneNode() as HTMLTemplateElement;

    element.innerHTML = html;

    return element.content;
};

const marker = fragment(SLOT_HTML).firstChild!;

const raf = globalThis?.requestAnimationFrame;

// Factory that caches the fragment for repeated cloning
const template = (html: string) => {
    let cached: DocumentFragment | undefined;

    return () => {
        if (!cached) {
            let element = tmpl.cloneNode() as HTMLTemplateElement;

            element.innerHTML = html;
            cached = element.content;
        }

        return clone(cached, true) as DocumentFragment;
    };
};

const text = (value: string) => {
    let element = txt.cloneNode();

    if (value !== '') {
        element.nodeValue = value;
    }

    return element;
};


export { clone, fragment, template, marker, raf, text };
