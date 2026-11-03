import { html } from '@esportsplus/template';


const footer = () => html`<footer class="site-footer"><p>Copyright</p><a href="/terms">Terms</a></footer>`;

const header = () => html`
    <header class="site-header">
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
    </header>
`;

const text = () => html`plain text without markup`;


export { footer, header, text };
