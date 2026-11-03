import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let state = reactive({ count: 0, name: 'x', open: false });


const counter = () => html`<button>${() => state.count}</button>`;

const status = () => html`<div><span>${() => state.open ? 'Open' : 'Closed'}</span><em>${() => state.name}</em></div>`;


export { counter, status };
