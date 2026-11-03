import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let state = reactive({ index: 0, total: 10 });


const href = (base: string, id: number) => html`<a href="/${base}/${id}/edit">edit</a>`;

const progress = (name: string) => html`<progress aria-label="${name}: ${() => state.index} of ${() => state.total}" value=${() => state.index}></progress>`;


export { href, progress };
