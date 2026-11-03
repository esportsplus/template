import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let state = reactive({ error: '', loading: true });


const view = (empty: boolean) => html`
    <div>
        ${empty ? html`<p>Nothing</p>` : html`<ul><li>one</li></ul>`}
        ${() => state.loading ? html`<i>Loading</i>` : state.error ? html`<b>${state.error}</b>` : ''}
    </div>
`;


export { view };
