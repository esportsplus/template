import { html } from '@esportsplus/template';


const badge = (n: number) => html`<span class="badge">${n}</span>`;

const card = (title: string, n: number) => html`
    <article>
        <h3>${title}</h3>
        ${badge(n)}
        ${html`<footer><b>${title}</b></footer>`}
        ${html`<hr />`}
    </article>
`;


export { card };
