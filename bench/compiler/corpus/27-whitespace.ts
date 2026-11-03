import { html } from '@esportsplus/template';


const pre = (code: string) => html`
    <pre>
        <code class="language-ts">${code}</code>
    </pre>
    <p title="  spaced   value  ">  text   with   gaps  </p>
`;


export { pre };
