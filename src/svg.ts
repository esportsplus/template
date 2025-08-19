import html from './html';


const svg = html.bind(null) as typeof html & {
    sprite: (href: string) => ReturnType<typeof html>
};

svg.sprite = (href: string) => {
    if (href[0] !== '#') {
        href = '#' + href;
    }

    return html`<svg><use ${{ ['href']: href }} /></svg>`;
};


export default svg;