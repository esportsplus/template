import { html } from '@esportsplus/template';


const button = (primary: boolean, label: string) => html`<button class="btn ${primary ? 'btn--primary' : 'btn--ghost'}">${label}</button>`;

const size = (large: boolean) => html`<div class="${large ? 'lg' : 'sm'}" data-size=${large ? 'large' : 'small'}></div>`;


export { button, size };
