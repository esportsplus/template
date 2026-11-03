import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let count = reactive(0),
    state = reactive({ label: 'total', open: false }),
    total = reactive(() => count * 2);


const view = () => html`
    <div class=${() => state.open ? 'open' : 'closed'} title="${() => state.label}: ${() => count}">
        ${() => count}
        ${() => `${state.label} ${count} of ${total}`}
        ${() => count > 0 ? html`<b>${() => count + total}</b>` : html`<i>${state.label}</i>`}
        ${() => [count, total].map((value) => html`<em data-value=${value}>${() => value + count}</em>`)}
    </div>
`;


export { view };
