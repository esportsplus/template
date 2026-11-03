import { html } from '@esportsplus/template';


const greeting = (name: string, count: number) => html`<p>Hello ${name}, you have ${count} messages</p>`;

const label = (value: string | null) => html`<span>${value}</span>`;

const pair = (a: string, b: number) => html`<dl><dt>${a}</dt><dd>${b}</dd></dl>`;


export { greeting, label, pair };
