import html from './html';


const svg = (literals: TemplateStringsArray, ...values: unknown[]) => {
    return html(literals, ...values);
};

svg.sprite = (svg: { symbol: string }) => {
    return html`<svg><use href="${svg.symbol}" /></svg>`;
};


export default svg;