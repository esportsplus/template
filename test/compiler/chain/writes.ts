import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let count = reactive(0),
    step = reactive(1),
    total = reactive(0);


const counter = () => html`
    <button onclick=${() => count++}>+</button>
    <button onclick=${() => { count -= step; }}>-</button>
    <button onclick=${() => { total = count + step; }}>sum</button>
    <button onclick=${(event: Event) => { step = (event.target as HTMLInputElement).valueAsNumber || step; }}>step</button>
    <output>${() => total}</output>
`;

const local = (initial: number) => {
    let value = reactive(initial);

    return html`<button onclick=${() => value++}>${() => value}</button>`;
};


export { counter, local };
