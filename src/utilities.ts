import { SLOT_HTML } from './shared-constants';


let clonableTemplate = document.createElement('template'),
    clonableText = document.createTextNode('');


const append = DocumentFragment.prototype.append;

// Firefox's importNode outperforms cloneNode in certain scenarios
const clone = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox')
    ? document.importNode.bind(document)
    : (node: Node, deep: boolean = true): Node => node.cloneNode(deep);

// Create a fragment from HTML string
const fragment = (html: string): DocumentFragment => {
    let element = clonableTemplate.cloneNode() as HTMLTemplateElement;

    element.innerHTML = html;

    return element.content;
};

// Factory that caches the fragment for repeated cloning
const template = (html: string) => {
    let cached: DocumentFragment | undefined;

    return () => {
        if (!cached) {
            let element = clonableTemplate.cloneNode() as HTMLTemplateElement;
            element.innerHTML = html;
            cached = element.content;
        }

        return clone(cached, true) as DocumentFragment;
    };
};

const marker = fragment(SLOT_HTML).firstChild!;

const raf = globalThis?.requestAnimationFrame;

const text = (value: string) => {
    let element = clonableText.cloneNode();

    if (value !== '') {
        element.nodeValue = value;
    }

    return element;
};


export { append, clone, fragment, template, marker, raf, text };
