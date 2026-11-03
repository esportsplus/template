import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let ui = reactive({ bold: false, width: 10 });


const bar = (color: string) => html`<div style="color: ${color}; width: ${() => ui.width}px; ${() => ui.bold && 'font-weight: bold'}"></div>`;

const box = (style: string) => html`<div style=${style}></div>`;

const object = () => html`<div style=${() => ({ height: `${ui.width}px`, opacity: ui.bold ? 1 : 0.5 })}></div>`;


export { bar, box, object };
