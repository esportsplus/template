import { html } from '@esportsplus/template';


const rows = (a: string, b: string) => html`<dt>${a}</dt><dd>${b}</dd>`;

const siblings = (a: string) => html`<h1>${a}</h1><p>intro</p><p>${a}</p>`;


export { rows, siblings };
