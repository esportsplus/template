import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let rows = reactive([] as { id: number; label: string }[]);


const grid = () => html`<div class="viewport">${html.virtual(rows, (row) => html`<div class="row">${row.id} ${row.label}</div>`)}</div>`;


export { grid };
