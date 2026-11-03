import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let ui = reactive({ busy: false, label: 'Save', locked: false });


const button = () => html`<button aria-busy=${() => ui.busy} disabled=${() => ui.locked} title=${() => ui.label}>${() => ui.label}</button>`;


export { button };
