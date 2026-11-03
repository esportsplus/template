import { html } from '@esportsplus/template';


const user = (load: () => Promise<string>) => html`<div>${async () => html`<b>${await load()}</b>`}</div>`;


export { user };
