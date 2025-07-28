import html from './html';
import { RenderableTemplate } from './types';


const svg = html.bind(null) as typeof html & {
    sprite: <T>(symbol: string) => RenderableTemplate<T>
};

svg.sprite = (symbol: string) => {
    if (symbol[0] !== '#') {
        symbol = '#' + symbol;
    }

    return html`<svg><use xlink:href='${symbol}' /></svg>`;
};


export default svg;