import { TEMPLATE } from './constants';


type EventListener = (e: Event) => void;

type Template = {
    [TEMPLATE]: boolean;
    expressions?: unknown[];
    html: string;
    slots?: {
        path: number[];
        type: string;
    }[];
};


export { EventListener, Template };