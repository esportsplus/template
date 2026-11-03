import { html } from '@esportsplus/template';


const mounted = (log: (s: string) => void) => html`
    <div onconnect=${(element: HTMLElement) => log(element.tagName)} ondisconnect=${() => log('gone')}>
        <span onfirstpaint=${() => log('paint')} ontick=${(dispose: VoidFunction) => dispose()}></span>
    </div>
`;


export { mounted };
