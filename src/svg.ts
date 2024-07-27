import html from './html';


const svg = <T>(literals: TemplateStringsArray, ...values: T[]) => {
    return html(literals, ...values);
};

svg.sprite = ({ symbol }: { symbol: string }) => {
    return html`<svg><use href='${symbol}' /></svg>`;
};


export default svg;