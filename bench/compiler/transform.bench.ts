import { ts } from '@esportsplus/typescript';
import { bench, describe } from 'vitest';
import { generateCode } from '../../src/compiler/codegen';
import { findHtmlTemplates, findReactiveCalls, findTemplateArtifacts } from '../../src/compiler/ts-parser';


const COMPONENTS = 100;


function build(n: number): string {
    let lines: string[] = ['import { html } from "@esportsplus/template";'];

    for (let i = 0; i < n; i++) {
        lines.push(
            'const component' + i + ' = (v: { list: string[]; x: string; y: string }) => html`' +
            '<div class="row ${v.x}" data-index="' + i + '"><span>${v.y}</span>' +
            '${v.list.length ? html`<b>${v.x}</b>` : ""}' +
            '<ul>${html.reactive(v.list, (item) => html`<li>${item}</li>`)}</ul>' +
            '</div>`;'
        );
    }

    return lines.join('\n');
}


const SOURCE = build(COMPONENTS);


let sourceFile = ts.createSourceFile('bench.ts', SOURCE, ts.ScriptTarget.Latest, true);


describe('compiler — transform (100 components, nested templates + reactive calls)', () => {
    bench('findHtmlTemplates + generateCode', () => {
        generateCode(findHtmlTemplates(sourceFile), sourceFile);
    });

    bench('discovery walks (findHtmlTemplates + findReactiveCalls)', () => {
        findHtmlTemplates(sourceFile);
        findReactiveCalls(sourceFile);
    });

    bench('discovery combined (findTemplateArtifacts)', () => {
        findTemplateArtifacts(sourceFile);
    });
});
