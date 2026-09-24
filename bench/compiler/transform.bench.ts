import { test } from 'vitest';
import { languageService } from '@esportsplus/typescript/compiler';
import { generateCode } from '../../src/compiler/codegen';
import { findTemplateArtifacts } from '../../src/compiler/ts-parser';


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


let { checker, sourceFile } = languageService.scratch(process.cwd() + '/bench.ts', SOURCE);


test('compiler — transform (100 components, nested templates + reactive calls)', async ({ bench }) => {
    await bench.compare(
        bench('findTemplateArtifacts + generateCode', () => {
            generateCode(findTemplateArtifacts(sourceFile), sourceFile);
        }),
        bench('findTemplateArtifacts + generateCode (with checker)', () => {
            generateCode(findTemplateArtifacts(sourceFile, checker), sourceFile, checker);
        }),
        bench('discovery (findTemplateArtifacts)', () => {
            findTemplateArtifacts(sourceFile);
        })
    );
});
