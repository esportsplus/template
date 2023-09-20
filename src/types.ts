import { TEMPLATE } from './constants';


type Template = {
    [TEMPLATE]: boolean;
    expressions?: unknown[];
    html: string;
};


export { Template };