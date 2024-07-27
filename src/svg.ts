import html from './html';


const svg = (literals: TemplateStringsArray, ...values: unknown[]) => {
    return html(literals, ...values);
};

svg.sprite = ({ symbol }: { symbol: string }) => {
    return html`<svg><use href='${symbol}' /></svg>`;
};


export default svg;