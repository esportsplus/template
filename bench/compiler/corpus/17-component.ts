import { html, type Attributes } from '@esportsplus/template';


function chip(attributes: Attributes, tone: string) {
    return html`<span class="chip chip--${tone}" ${attributes}>${tone}</span>`;
}

function field(label: string, attributes: Attributes) {
    return html`
        <label class="field">
            <span>${label}</span>
            <input ${attributes} />
        </label>
    `;
}


export { chip, field };
