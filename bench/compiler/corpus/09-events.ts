import { html } from '@esportsplus/template';


const form = (submit: (e: Event) => void, input: (e: Event) => void) => html`
    <form onsubmit=${submit}>
        <input oninput=${input} onchange=${(e: Event) => input(e)} />
        <button onclick=${() => console.log('click')} oncemouseover=${() => console.log('once')}>Go</button>
    </form>
`;

const global = (fn: () => void) => html`<div onwindowresize=${fn} ondocumentkeydown=${fn}></div>`;


export { form, global };
