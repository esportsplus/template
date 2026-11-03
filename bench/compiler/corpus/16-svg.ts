import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let ui = reactive({ active: false, r: 4 });


const icon = (path: string) => html`
    <svg viewBox="0 0 24 24" width="24" height="24">
        <path d=${path} />
        <circle class="${() => ui.active && 'on'}" cx="12" cy="12" r=${() => ui.r}></circle>
        <rect x="0" y="0" width="4" height="4"></rect>
    </svg>
`;


export { icon };
