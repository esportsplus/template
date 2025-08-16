import html from './html';


const svg = html.bind(null) as typeof html & {
    sprite: (symbol: string) => ReturnType<typeof html>
};

svg.sprite = (symbol: string) => {
    if (symbol[0] !== '#') {
        symbol = '#' + symbol;
    }

    return html`<svg><use xlink:href='${symbol}' /></svg>`;
};


export default svg;