import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let count = reactive(0),
    list = reactive(['a', 'b', 'c']),
    title = reactive('title');


const view = () => html`
    <p>${() => list[count]}</p>
    <p>${() => list.length}</p>
    <span ${{ count, title }}></span>
    <span ${{ class: () => title, count: () => count }}></span>
    <ul>${html.reactive(list, (item) => html`<li class=${() => item === title ? 'on' : ''}>${item}</li>`)}</ul>
`;


export { view };
