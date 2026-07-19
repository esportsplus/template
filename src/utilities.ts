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

const EMPTY_FRAGMENT = fragment('');

const marker = fragment(SLOT_HTML).firstChild!;

const raf = globalThis?.requestAnimationFrame;

// Factory that caches the fragment for repeated cloning; markup-free html skips the parse
const template = (html: string): (() => DocumentFragment | Text) => {
    // A markup-free template is provably slotless (node slots carry '<!--$-->', elements carry '<'),
    // so no caller walks into it - clone a text node instead of paying the innerHTML parse
    if (html.length > 0 && html.indexOf('<') === -1) {
        return () => text(html);
    }

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
    let element = txt.cloneNode() as Text;

    if (value !== '') {
        element.nodeValue = value;
    }

    return element;
};


export { clone, EMPTY_FRAGMENT, fragment, marker, raf, template, text };
