import { html } from '@esportsplus/template';


const deep = (a: string, b: string, c: string) => html`
    <main>
        <section>
            <div><div><div><p>${a}</p></div></div></div>
            <aside><ul><li><a href=${b}>${b}</a></li><li>${c}</li></ul></aside>
        </section>
        <section><p>static</p><p>${c}</p></section>
    </main>
`;


export { deep };
