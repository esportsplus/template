import { reactive, read, signal, write } from '@esportsplus/reactivity';
import { type Attributes, html } from '@esportsplus/template';


type App = ReturnType<typeof create>;

type Card = {
    body: string;
    cta: string;
    href: string;
    index: number;
    key: string;
    state: { liked: boolean; likes: number };
    tag: string;
    title: string;
    tone: string;
};

type Row = {
    base: string;
    href: string;
    id: number;
    kind: string;
    remove: string;
    short: string;
    state: { label: string };
    style: string;
};


const ADJECTIVES = [
    'pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome',
    'plain', 'quaint', 'clean', 'elegant', 'easy', 'angry', 'crazy', 'helpful',
    'mushy', 'odd', 'unsightly', 'adorable', 'important', 'inexpensive', 'cheap', 'expensive', 'fancy'
];

const COLOURS = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown', 'white', 'black', 'orange'];

const KINDS = ['info', 'muted', 'primary', 'success', 'warning'];

const NOUNS = ['table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie', 'sandwich', 'burger', 'pizza', 'mouse', 'keyboard'];


let cards = reactive([] as Card[]),
    id = 1,
    rows = reactive([] as Row[]),
    seed = 42,
    selected = signal(0),
    ui = reactive({ bold: false, compact: false, dense: false, locked: false });


function badge(kind: string, count: number) {
    return html`<span class="badge badge--${kind}" title=${kind}>${count}</span>`;
}

// A component whose root takes the caller's attributes: its own class parts and the spread's join one list
function chip(attributes: Attributes, tone: string, state: Card['state']) {
    return html`<span class="chip chip--${tone} ${() => state.likes > 12 && 'chip--hot'}" ${attributes}>${tone}</span>`;
}

function card(item: Card) {
    return html`
        <article class="card card--${item.tone} ${() => item.state.liked && 'card--liked'}" id=${item.key} data-index=${item.index}>
            <header>
                <h3 title=${item.title}>${item.title}</h3>
                ${badge(item.tag, item.index % 5)}
                ${chip({ class: () => item.state.liked && 'chip--on', title: item.tag }, item.tone, item.state)}
            </header>
            <p class=${item.tone}>${item.body}</p>
            <footer>
                <a href=${item.href} aria-label=${item.cta}>${item.cta}</a>
                <span style="--likes: ${() => item.state.likes}">${() => item.state.likes}</span>
                <button type="button" aria-pressed=${() => item.state.liked} onclick=${() => like(item)}>
                    ${() => item.state.liked ? 'Liked' : 'Like'}
                </button>
            </footer>
        </article>
    `;
}

function like(item: Card) {
    item.state.liked = !item.state.liked;
    item.state.likes += item.state.liked ? 1 : -1;
}

function makeCards(n: number): Card[] {
    // oxlint-disable-next-line unicorn/no-new-array -- preallocated to its final length, every slot is written next
    let items: Card[] = new Array(n);

    for (let i = 0; i < n; i++) {
        let index = id++,
            noun = NOUNS[random(NOUNS.length)],
            title = `${ADJECTIVES[random(ADJECTIVES.length)]} ${noun}`;

        items[i] = {
            body: `The ${title} is ${COLOURS[random(COLOURS.length)]} and ready to ship.`,
            cta: `Open ${title}`,
            href: `/items/${index}`,
            index,
            key: `card-${index}`,
            state: reactive({ liked: false, likes: index % 13 }),
            tag: KINDS[random(KINDS.length)],
            title,
            tone: KINDS[random(KINDS.length)]
        };
    }

    return items;
}

function makeRows(n: number): Row[] {
    // oxlint-disable-next-line unicorn/no-new-array -- preallocated to its final length, every slot is written next
    let items: Row[] = new Array(n);

    for (let i = 0; i < n; i++) {
        let adjective = ADJECTIVES[random(ADJECTIVES.length)],
            base = `${adjective} ${COLOURS[random(COLOURS.length)]} ${NOUNS[random(NOUNS.length)]}`,
            key = id++;

        items[i] = {
            base,
            href: `#row-${key}`,
            id: key,
            kind: KINDS[random(KINDS.length)],
            remove: `Remove ${base}`,
            short: adjective,
            state: reactive({ label: base }),
            style: `--index: ${i}`
        };
    }

    return items;
}

// Deterministic LCG so both builds render identical data
function random(max: number) {
    seed = (seed * 1664525 + 1013904223) >>> 0;

    return seed % max;
}

function remove(data: Row) {
    rows.splice(rows.indexOf(data), 1);
}

// Stands in for a class part doing real work; it reads only the row's label
function tone(data: Row) {
    let hash = 0,
        label = data.state.label;

    for (let i = 0; i < 64; i++) {
        for (let j = 0, n = label.length; j < n; j++) {
            hash = (hash * 31 + label.charCodeAt(j)) | 0;
        }
    }

    return `tone-${hash & 3}`;
}

function row(data: Row) {
    return html`
        <tr class="${() => read(selected) === data.id && 'danger'} ${() => ui.dense && 'row--dense'} ${() => tone(data)}" aria-selected=${() => read(selected) === data.id}>
            <td class="col-md-1">${data.id}</td>
            <td class="col-md-4 ${() => ui.dense && 'dense'}">
                <a href=${data.href} style=${() => ui.bold ? 'font-weight: bold' : ''} title=${data.base} onclick=${() => write(selected, data.id)}>${() => data.state.label}</a>
            </td>
            <td class="col-md-2">${badge(data.kind, data.id % 7)}</td>
            <td class="col-md-1">
                <button aria-label=${data.remove} disabled=${() => ui.locked} type="button" onclick=${() => remove(data)}>
                    <span class="glyphicon glyphicon-remove" aria-hidden="true"></span>
                </button>
            </td>
            <td class=${data.kind} style=${data.style}>${() => ui.compact ? data.short : data.state.label}</td>
        </tr>
    `;
}


const create = (container: HTMLElement) => {
    let flip = false;

    container.appendChild(html`
        <table class="table table-hover table-striped test-data">
            <tbody>${html.reactive(rows, row)}</tbody>
        </table>
        <section class="cards">${html.reactive(cards, card)}</section>
    `);

    return {
        appendCards: (n: number) => {
            cards.push(...makeCards(n));
        },
        appendRows: (n: number) => {
            rows.push(...makeRows(n));
        },
        cards,
        clearCards: () => {
            cards.clear();
        },
        clearRows: () => {
            rows.clear();
        },
        likeEvery10th: () => {
            for (let i = 0, n = cards.length; i < n; i += 10) {
                like(cards[i]);
            }
        },
        partialUpdate: () => {
            // Toggle instead of append so label size stays stable across samples
            flip = !flip;

            let suffix = flip ? ' !!!' : '';

            for (let i = 0, n = rows.length; i < n; i += 10) {
                rows[i].state.label = rows[i].base + suffix;
            }
        },
        removeRow: () => {
            rows.splice(rows.length >> 1, 1);
        },
        rows,
        select: (index: number) => {
            write(selected, rows[index].id);
        },
        swap: () => {
            if (rows.length < 999) {
                return;
            }

            let a = rows[1],
                b = rows[998];

            rows[1] = b;
            rows[998] = a;
        },
        toggleBold: () => {
            ui.bold = !ui.bold;
        },
        toggleCompact: () => {
            ui.compact = !ui.compact;
        },
        toggleDense: () => {
            ui.dense = !ui.dense;
        },
        toggleLocked: () => {
            ui.locked = !ui.locked;
        }
    };
};


export { create };
export type { App };
