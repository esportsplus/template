import { setProperty } from './attributes';
import { template } from './utilities';
import { Element } from './types';
import html from './html';


let factory = template('<svg><use /></svg>');


const svg = html.bind(null) as typeof html & {
    sprite: (href: string) => DocumentFragment
};

svg.sprite = (href: string) => {
    if (href[0] !== '#') {
        href = '#' + href;
    }

    let root = factory();

    setProperty(root.firstChild!.firstChild as Element, 'href', href);

    return root;
};


export default svg;
