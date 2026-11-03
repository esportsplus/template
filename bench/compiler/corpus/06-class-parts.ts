import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let ui = reactive({ active: false, dense: false, tone: 'info' });


const item = (kind: string) => html`<li class="item item--${kind} ${() => ui.active && 'active'} ${() => ui.dense && 'dense'}">${kind}</li>`;

const panel = () => html`<section class="panel ${() => `panel--${ui.tone}`}"><h2 class="title">Panel</h2></section>`;

const plain = (cls: string) => html`<div class=${cls}></div>`;


export { item, panel, plain };
