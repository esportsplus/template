import { html } from '@esportsplus/template';


const classes = (list: string[]) => html`<div class=${list}></div>`;

const items = (list: string[]) => html`<ul>${list.map((item) => html`<li>${item}</li>`)}</ul>`;


export { classes, items };
