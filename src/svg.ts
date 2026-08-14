import { setProperty } from './attributes';
import { template } from './utilities';
import { Element } from './types';


let factory = template('<svg><use /></svg>');


export default (href: string) => {
    if (href[0] !== '#') {
        href = '#' + href;
    }

    let root = factory() as DocumentFragment;

    setProperty(root.firstChild!.firstChild as Element, 'href', href);

    return root;
};
