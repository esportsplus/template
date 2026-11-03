import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';


type Card = { href: string; index: number; key: string; state: { liked: boolean; likes: number }; title: string; tone: string };


let cards = reactive([] as Card[]);


function card(item: Card) {
    return html`
        <article class="card card--${item.tone} ${() => item.state.liked && 'card--liked'}" id=${item.key} data-index=${item.index}>
            <header><h3 title=${item.title}>${item.title}</h3>${chip({ class: () => item.state.liked && 'chip--on', title: item.title }, item.tone)}</header>
            <footer>
                <a href=${item.href}>open</a>
                <span>${() => item.state.likes}</span>
                <button aria-pressed=${() => item.state.liked} onclick=${() => item.state.liked = !item.state.liked}>${() => item.state.liked ? 'Liked' : 'Like'}</button>
            </footer>
        </article>
    `;
}

function chip(attributes: Attributes, tone: string) {
    return html`<span class="chip chip--${tone}" ${attributes}>${tone}</span>`;
}


const list = () => html`<section class="cards">${html.reactive(cards, card)}</section>`;


export { list };
