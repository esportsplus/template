import { html } from '@esportsplus/template';


const anchor = (href: string, title: string) => html`<a href=${href} title=${title} target="_blank">link</a>`;

const data = (id: number, kind: string) => html`<div data-id=${id} data-kind="${kind}" aria-label="item ${id}"></div>`;

const input = (value: string, disabled: boolean) => html`<input type="text" value=${value} disabled=${disabled} />`;


export { anchor, data, input };
