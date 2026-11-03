import { read, reactive, signal } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let items = reactive([] as { id: number }[]),
    selected = signal(0);


const list = () => html`<ul>${html.reactive(items, (item) => html`<li class="${() => read(selected) === item.id ? 'on' : ''}" aria-selected=${() => read(selected) === item.id}>${item.id}</li>`)}</ul>`;


export { list };
