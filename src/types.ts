import { EVENT_BAIL, EVENT_DELEGATED, EVENT_LISTENER, TEMPLATE } from './constants';


type EventAction = {
    type: typeof EVENT_BAIL | typeof EVENT_DELEGATED | typeof EVENT_LISTENER;
    value: HTMLElement | EventListener | null;
};

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


export { EventAction, EventListener, Template };