import { describe, expect, it } from 'vitest';
import { languageService } from '@esportsplus/typescript/compiler';
import { findRemovals } from '../../src/compiler/removal';
import { findTemplateArtifacts } from '../../src/compiler/ts-parser';


const CALLS = [
    'remove()',
    'replaceWith(document.createElement("i"))',
    'replaceChildren()',
    'removeChild(document.body)',
    'insertAdjacentHTML("beforeend", "<i></i>")'
];

const WRITES = ['innerHTML', 'outerHTML', 'textContent', 'innerText'];

const REMOVALS = [...CALLS, ...WRITES.map(member => `${member} = ''`)];


async function found(...lines: string[]) {
    let sourceFile = await languageService.parse(process.cwd() + '/removal.ts', lines.join('\n'));

    return findRemovals(await findTemplateArtifacts(sourceFile), sourceFile).map(removal => removal.text);
}


describe('compiler/removal', () => {
    describe('flags removal through every traceable origin', () => {
        it.each(REMOVALS)('a lifecycle hook element: %s', async (removal) => {
            for (let hook of ['onconnect', 'ondisconnect', 'onfirstpaint']) {
                expect(await found(`html\`<div ${hook}=\${(element) => element.${removal}}></div>\`;`)).toHaveLength(1);
            }

            expect(await found(`html\`<div ontick=\${(dispose, element) => { element.${removal}; }}></div>\`;`)).toHaveLength(1);
            expect(await found(`html\`<div onconnect=\${(element, on) => { element.${removal}; }}></div>\`;`)).toHaveLength(1);
            expect(await found(`html\`<div \${{ onconnect: (element, on) => { element.${removal}; } }}></div>\`;`)).toHaveLength(1);
        });

        it.each(REMOVALS)('an event handler\'s this: %s', async (removal) => {
            for (let event of ['onclick', 'onceclick', 'ondocumentkeydown', 'onwindowresize']) {
                expect(await found(`html\`<div ${event}="\${function () { this.${removal}; }}"></div>\`;`)).toHaveLength(1);
            }
        });

        it.each(REMOVALS)('an html result: %s', async (removal) => {
            expect(await found(`let view = html\`<div></div>\`;`, `view.${removal};`)).toHaveLength(1);
        });

        it('a spread attribute object', async () => {
            expect(await found(
                `html\`<div \${{ onconnect: (el) => el.remove(), onclick() { this.innerHTML = ''; } }}></div>\`;`
            )).toEqual(['el.remove', 'this.innerHTML']);
        });

        it('variables initialized from an origin, through casts and arrows', async () => {
            expect(await found(
                `html\`<div onconnect=\${(element) => {`,
                `    let input = element as HTMLInputElement;`,
                `    const again = (input);`,
                `    setTimeout(() => again!.remove());`,
                `}} onclick=\${function () { let self = this; queueMicrotask(() => self.textContent = ''); }}></div>\`;`
            )).toEqual(['again!.remove', 'self.textContent']);
        });

        it('compound writes', async () => {
            expect(await found(`html\`<div onconnect=\${(el) => { el.innerHTML += '<i></i>'; }}></div>\`;`)).toEqual(['el.innerHTML']);
        });
    });

    describe('leaves everything else alone', () => {
        it('raw DOM', async () => {
            expect(await found(
                `let node = document.createElement('div');`,
                `node.remove();`,
                `node.innerHTML = '';`,
                `html\`<div onconnect=\${(el) => { let raw = document.createElement('i'); el.append(raw); raw.remove(); }}></div>\`;`
            )).toEqual([]);
        });

        it('untraceable values', async () => {
            expect(await found(
                `declare let handler: (el: HTMLElement) => void;`,
                `declare let other: HTMLElement;`,
                `html\`<div onconnect=\${handler} onclick=\${(event) => (event.currentTarget as HTMLElement).remove()}></div>\`;`,
                `html\`<div onconnect=\${(el) => { el.querySelector('i')!.remove(); el.firstChild!.remove(); other.remove(); }}></div>\`;`,
                `let reused = html\`<div></div>\`;`,
                `reused = other as any;`,
                `reused.remove();`
            )).toEqual([]);
        });

        it('arrow event handlers, whose this is not the element', async () => {
            expect(await found(`function f(this: HTMLElement) { return html\`<div onclick=\${() => this.remove()}></div>\`; }`)).toEqual([]);
        });

        it('the element parameter of an event handler, which is the event', async () => {
            expect(await found(`html\`<div onclick=\${(e) => e.remove?.()}></div>\`;`)).toEqual([]);
        });

        it('shadowed names', async () => {
            expect(await found(
                `html\`<div onconnect=\${(el) => {`,
                `    items.forEach((el) => el.remove());`,
                `    { let el = document.createElement('i'); el.remove(); }`,
                `    queueMicrotask(function () { this.remove(); });`,
                `}}></div>\`;`,
                `declare let items: HTMLElement[];`
            )).toEqual([]);
        });

        it('reads, other members, and non-element parameters', async () => {
            expect(await found(
                `html\`<div ontick=\${(dispose, el) => { dispose.remove?.(); let text = el.textContent + el.innerHTML; el.classList.remove('x'); }}></div>\`;`,
                `html\`<div class=\${(el) => { el.remove(); return ''; }}></div>\`;`
            )).toEqual([]);
        });

        it('template-driven updates', async () => {
            expect(await found(
                `declare let rows: any;`,
                `html\`<ul>\${html.reactive(rows, (row) => html\`<li>\${() => row.text}</li>\`)}</ul>\`;`,
                `html\`<p class=\${() => 'on'}>\${() => 'text'}</p>\`;`
            )).toEqual([]);
        });

        it('files without templates', async () => {
            expect(await found(`let el = document.body; el.remove();`)).toEqual([]);
        });
    });

    it('locates each removal by its offset in the source', async () => {
        let sourceFile = await languageService.parse(process.cwd() + '/removal.ts', [
                `html\`<a onconnect=\${(el) => el.remove()}></a>\`;`,
                `html\`<b onconnect=\${(el) => el.remove()}></b>\`;`
            ].join('\n')),
            removals = findRemovals(await findTemplateArtifacts(sourceFile), sourceFile);

        expect(removals.map(r => [r.member, r.text])).toEqual([['remove', 'el.remove'], ['remove', 'el.remove']]);
        expect(removals[1].start).toBe(sourceFile.text.lastIndexOf('el.remove'));
    });
});
