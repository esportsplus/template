import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let list = reactive([] as string[]);


const c0 = (x: string, y: string) => html`<div class="row ${x}" data-index="0"><span>${y}</span>${list.length ? html`<b>${x}</b>` : ''}<ul>${html.reactive(list, (item) => html`<li>${item}</li>`)}</ul></div>`;

const c1 = (x: string, y: string) => html`<div class="row ${x}" data-index="1"><span>${y}</span>${list.length ? html`<b>${x}</b>` : ''}<ul>${html.reactive(list, (item) => html`<li>${item}</li>`)}</ul></div>`;

const c2 = (x: string, y: string) => html`<div class="row ${x}" data-index="2"><span>${y}</span>${list.length ? html`<b>${x}</b>` : ''}<ul>${html.reactive(list, (item) => html`<li>${item}</li>`)}</ul></div>`;

const c3 = (x: string, y: string) => html`<div class="row ${x}" data-index="3"><span>${y}</span>${list.length ? html`<b>${x}</b>` : ''}<ul>${html.reactive(list, (item) => html`<li>${item}</li>`)}</ul></div>`;


export { c0, c1, c2, c3 };
