import { html, type Attributes } from '@esportsplus/template';


const button = (attributes: Attributes) => html`<button class="btn" ${attributes}>Go</button>`;

const literal = (id: string) => html`<div ${{ class: 'a b', id, title: 'x' }}></div>`;

const many = (a: Attributes, b: Attributes) => html`<div ${a} ${b}></div>`;


export { button, literal, many };
