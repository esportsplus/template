import html from './html';


const svg = (literals: TemplateStringsArray, ...values: unknown[]) => {
    return html(literals, ...values);
};

svg.sprite = (symbol: string) => {
    if (symbol[0] !== '#') {
        symbol = '#' + symbol;
    }

    return html`<svg><use xlink:href='${symbol}' /></svg>`;
};


export default svg;