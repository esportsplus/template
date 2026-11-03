import { html } from '@esportsplus/template';


const KIND = 'primary';

const SIZE = 12;


const tag = () => html`<span class="tag tag--${KIND}" data-size=${SIZE}>${KIND}</span>`;


export { tag };
