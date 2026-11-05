import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { languageService } from '@esportsplus/typescript/compiler';
import type { TransformContext } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT_REACTIVITY, ENTRYPOINT_VIRTUAL, NAMESPACE } from '../../src/compiler/constants';
import { generateCode } from '../../src/compiler/codegen';
import { findTemplateArtifacts } from '../../src/compiler/ts-parser';
import transform from '../../src/compiler';
import vite from '../../src/compiler/plugins/vite';
import { prepended, written } from './written';


const EMPTY = await languageService.parse(process.cwd() + '/empty.ts', '');


async function createContext(source: string) {
    let sourceFile = await languageService.parse(process.cwd() + '/test.ts', source);

    return { checker: undefined, sourceFile } as unknown as TransformContext;
}


describe('compiler/virtual', () => {
    describe('html.virtual() - standalone', () => {
        it('compiles to a VirtualSlot construction with the list and the compiled row', async () => {
            let context = await createContext(
                    `import { html } from '@esportsplus/template';\nlet el = html.virtual(list, (item) => html\`<li>\${() => item.name}</li>\`);`
                ),
                result = await transform.transform(context),
                code = result.replacements![0].generate(context.sourceFile, written);

            expect(code).toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).toContain('list');
            expect(code).not.toContain(`${NAMESPACE}.ArraySlot`);
            expect(code).not.toContain('html.virtual');
            expect(prepended(result).prepend.some(p => p.includes('<li>'))).toBe(true);
            expect(prepended(result).prepend.some(p => p.includes(`${NAMESPACE}.template`))).toBe(true);
        });

        it('records the virtual entrypoint during matching', async () => {
            let sourceFile = await languageService.parse(process.cwd() + '/test.ts',
                    `import { html } from '@esportsplus/template';\nlet el = html.virtual(list, (item) => html\`<li>\${item}</li>\`);`
                ),
                calls = (await findTemplateArtifacts(sourceFile)).calls;

            expect(calls).toHaveLength(1);
            expect(calls[0].entrypoint).toBe(ENTRYPOINT_VIRTUAL);
        });
    });

    describe('html.virtual() - options', () => {
        it('passes a third argument through to the standalone construction', async () => {
            let context = await createContext(
                    `import { html } from '@esportsplus/template';\nlet el = html.virtual(list, (item) => html\`<li>\${item}</li>\`, { anchor: 'end' });`
                ),
                result = await transform.transform(context),
                code = result.replacements![0].generate(context.sourceFile, written);

            expect(code).toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).toContain(`{ anchor: 'end' }`);
        });

        it('passes a third argument through to the nested construction', async () => {
            let sourceFile = await languageService.parse(process.cwd() + '/test.ts',
                    `let x = html\`<div>\${html.virtual(items, (item) => html\`<span>\${item}</span>\`, { anchor: 'end' })}</div>\`;`
                ),
                result = await generateCode(await findTemplateArtifacts(sourceFile), sourceFile),
                code = result.replacements[0].generate(EMPTY, written);

            expect(code).toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).toContain(`{ anchor: 'end' }`);
        });
    });

    describe('html.virtual() - nested in a template', () => {
        it('generates a VirtualSlot for a virtual call in a node slot', async () => {
            let sourceFile = await languageService.parse(process.cwd() + '/test.ts',
                    `let x = html\`<div>\${html.virtual(items, (item) => html\`<span>\${item}</span>\`)}</div>\`;`
                ),
                result = await generateCode(await findTemplateArtifacts(sourceFile), sourceFile),
                code = result.replacements[0].generate(EMPTY, written);

            expect(code).toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).not.toContain(`${NAMESPACE}.ArraySlot`);
        });
    });

    describe('html.reactive() - unchanged', () => {
        it('still compiles to an ArraySlot construction', async () => {
            let result = await transform.transform(await createContext(
                    `import { html } from '@esportsplus/template';\nlet el = html.reactive(items, (item) => html\`<li>\${item}</li>\`);`
                )),
                code = result.replacements![0].generate(EMPTY, written);

            expect(code).toContain(`${NAMESPACE}.ArraySlot`);
            expect(code).not.toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).not.toContain('html.reactive');
        });

        it('records the reactive entrypoint during matching', async () => {
            let sourceFile = await languageService.parse(process.cwd() + '/test.ts',
                    `import { html } from '@esportsplus/template';\nlet el = html.reactive(items, (item) => html\`<li>\${item}</li>\`);`
                ),
                calls = (await findTemplateArtifacts(sourceFile)).calls;

            expect(calls).toHaveLength(1);
            expect(calls[0].entrypoint).toBe(ENTRYPOINT_REACTIVITY);
        });
    });

    describe('html.virtual pattern detection', () => {
        // An isolated project: parallel workers never see this module in their program
        it('vite plugin requests a full reload for a source containing only html.virtual', async () => {
            let root = mkdtempSync(join(process.cwd(), '.fixture-virtual-')).replace(/\\/g, '/'),
                file = root + '/virtual-only.ts',
                send = vi.fn();

            let source = [
                    `import { html } from '@esportsplus/template';`,
                    `export const value = 1;`,
                    `declare let items: any, row: any;`,
                    `let el = html.virtual(items, row);`
                ].join('\n');

            writeFileSync(file, source);
            writeFileSync(root + '/tsconfig.json', JSON.stringify({
                compilerOptions: { module: 'esnext', moduleResolution: 'bundler', strict: true, target: 'esnext', types: [] },
                files: ['./virtual-only.ts']
            }));

            try {
                let instance = vite({ root });

                instance.configResolved({ command: 'serve', root, server: {} });
                await instance.transform.handler(source, file);

                let result = instance.handleHotUpdate({
                    file,
                    modules: [{ isSelfAccepting: false }],
                    read: () => readFileSync(file, 'utf8'),
                    server: { ws: { send } }
                });

                expect(result).toEqual([]);
                expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
            }
            finally {
                rmSync(root, { force: true, recursive: true });
            }
        });
    });
});
