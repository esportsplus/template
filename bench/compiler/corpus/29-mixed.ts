import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';


let ui = reactive({ compact: false, count: 0, theme: 'dark' });


const toolbar = (attributes: Attributes, title: string) => html`
    <div class="toolbar ${() => ui.compact && 'toolbar--compact'}" data-theme=${() => ui.theme} style="--count: ${() => ui.count}" ${attributes}>
        <h2 class="toolbar__title">${title}</h2>
        <button class="btn" onclick=${() => ui.count++}>+</button>
        <output>${() => ui.count}</output>
    </div>
`;


export { toolbar };
