// Modules exercising every way site discovery can find, miss or reject `html`. Each also gets a staged twin
// (see './stage'), so it is searched on the program reactivity's edit produces as well.
const CORPUS: Record<string, string> = {
    'barrel.ts': [
        "export { html as tag } from '@esportsplus/template';",
        "export * from '@esportsplus/template';",
        "export * as T from '@esportsplus/template';",
        "import { html } from '@esportsplus/template';",
        'export default html;',
        'export const alias = html;',
        'export { html as again };'
    ].join('\n'),
    'other.ts': [
        'export const html = (strings: TemplateStringsArray, ...values: unknown[]) => strings.join(String(values));',
        'export default { html };'
    ].join('\n'),
    'forms.ts': [
        "import d, { again, alias, tag, html as h, T as N } from './barrel';",
        "import * as B from './barrel';",
        "import * as P from '@esportsplus/template';",
        "import { html } from '@esportsplus/template';",
        "import X = require('@esportsplus/template');",
        'const one = html, two = one;',
        'const three = two;',
        'const { html: four } = B.T, { T: five } = B, { html: six } = five;',
        'const seven = B.T, eight = seven.html;',
        "const { html: nine } = await import('@esportsplus/template');",
        'const ten = (B.T as typeof P).html, eleven = B.T!.html, twelve = (B.T satisfies typeof P).html;',
        'export const views = (label: string) => [',
        '    d`<p>${label}</p>`, again`<p>${label}</p>`, alias`<p>${label}</p>`, tag`<p>${label}</p>`, h`<p>${label}</p>`,',
        '    N.html`<p>${label}</p>`, B.T.html`<p>${label}</p>`, B.T[\'html\']`<p>${label}</p>`, B[\'T\'].html`<p>${label}</p>`,',
        '    P.html`<p>${label}</p>`, html`<p>${label}</p>`, X.html`<p>${label}</p>`, three`<p>${label}</p>`, four`<p>${label}</p>`,',
        '    six`<p>${label}</p>`, eight`<p>${label}</p>`, nine`<p>${label}</p>`, ten`<p>${label}</p>`, eleven`<p>${label}</p>`,',
        '    twelve`<p>${label}</p>`, (await import(\'@esportsplus/template\')).html`<p>${label}</p>`,',
        '    html.reactive([] as string[], (s) => html`<i>${s}</i>`), B.T.html.reactive([] as string[], (s) => h`<i>${s}</i>`)',
        '];',
        'export const nested = () => { const local = html; const again2 = local; return again2`<p>x</p>`; };'
    ].join('\n'),
    'members.ts': [
        "import * as P from '@esportsplus/template';",
        "declare function namespace(): typeof import('@esportsplus/template');",
        "export const fromCall = () => namespace().html`<p>call</p>`;",
        "export const fromParameter = (T: typeof import('@esportsplus/template')) => T.html`<p>parameter</p>`;",
        'export const fromNamespaceKey = () => P[\'html\']`<p>key</p>`;',
        "export const fromObject = () => { const holder = { html: P.html }; return holder.html`<p>object</p>`; };"
    ].join('\n'),
    'parameters.ts': [
        "type B = typeof import('./barrel');",
        "export const member = (B: typeof import('./barrel')) => B.tag`<p>member</p>`;",
        "export const nested = (B: typeof import('./barrel')) => B.T.html`<p>nested</p>`;",
        "export const keyed = (B: typeof import('./barrel')) => B['tag']`<p>keyed</p>` + B.alias`<p>alias</p>`;",
        "export const aliased = (B: B) => B.again`<p>again</p>` + B.default`<p>default</p>`;",
        "export const contextual = () => import('./barrel').then(B => B.tag`<p>contextual</p>`);",
        "export const destructured = ({ html }: typeof import('@esportsplus/template')) => html`<p>destructured</p>`;",
        "export const destructuredBarrel = ({ tag }: typeof import('./barrel')) => tag`<p>destructured</p>`;"
    ].join('\n'),
    'escapes.ts': [
        "import { html } from '@esportsplus/template';",
        "import * as B from './barrel';",
        'declare function take(value: unknown): void;',
        'let mutable = html;',
        'take(html);',
        'take(B.T.html);',
        'export const shorthand = { html };',
        'export const parenthesized = () => (html)`<p>x</p>`;',
        'export const member = html.reactive;',
        'const { reactive: pulled } = html;',
        'const [first] = [html];',
        'export const array = [first, pulled, mutable];',
        'export default html;'
    ].join('\n'),
    'shadowed.ts': [
        "import { html } from '@esportsplus/template';",
        "import other, { html as foreign } from './other';",
        'type Tag = (strings: TemplateStringsArray, ...values: unknown[]) => string;',
        'export const parameter = (html: Tag) => html`<i>parameter</i>`;',
        'export const local = () => { const html: Tag = (s) => s.join(); return html`<i>local</i>`; };',
        'export const caught = () => { try { return 1; } catch (html) { return (html as Tag)`<i>caught</i>`; } };',
        'export const foreignTag = () => foreign`<i>foreign</i>` + other.html`<i>default</i>`;',
        "export const property = () => ({ html: (s: TemplateStringsArray) => s.join() }).html`<i>property</i>`;",
        "export const keyed = () => ({ html: (s: TemplateStringsArray) => s.join() })['html']`<i>keyed</i>`;",
        'export class View { html: Tag = (s) => s.join(); render() { return this.html`<i>member</i>`; } }',
        'export const compiled = () => html`<p>compiled</p>`;'
    ].join('\n'),
    'types.ts': [
        "import type { html as typed } from '@esportsplus/template';",
        "import { html } from '@esportsplus/template';",
        'export type Tag = typeof html;',
        'export type Typed = typeof typed;',
        'export const value: typeof html | null = null;',
        'export const view = () => html`<p>typed</p>`;'
    ].join('\n'),
    're-exports.ts': [
        "export { html } from '@esportsplus/template';",
        "export { html as h2, T as T2 } from './barrel';",
        "export * as P from '@esportsplus/template';"
    ].join('\n'),
    'none.ts': [
        'const tag = (strings: TemplateStringsArray) => strings.join();',
        'export const plain = tag`<p>none</p>`;',
        'export const html = 1;'
    ].join('\n')
};

// Appended to make reactivity edit the module, so the template plugin runs on a staged program
const STAGE = "\nimport { reactive } from '@esportsplus/reactivity';\nconst state = reactive({ count: 1 });\nexport const count = () => state.count;\n";


export { CORPUS, STAGE };
