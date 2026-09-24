import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { languageService } from '@esportsplus/typescript/compiler';
import type { TransformContext } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT, ENTRYPOINT_REACTIVITY, ENTRYPOINT_VIRTUAL, NAMESPACE } from '../../src/compiler/constants';
import { generateCode } from '../../src/compiler/codegen';
import { findTemplateArtifacts } from '../../src/compiler/ts-parser';
import transform from '../../src/compiler';
import vite from '../../src/compiler/plugins/vite';


const EMPTY = languageService.parse(process.cwd() + '/empty.ts', '');


function createContext(source: string) {
    let sourceFile = languageService.parse(process.cwd() + '/test.ts', source);

    return { checker: undefined, sourceFile } as unknown as TransformContext;
}


describe('compiler/virtual', () => {
    describe('html.virtual() - standalone', () => {
        it('compiles to a VirtualSlot construction with the list and the compiled row', () => {
            let context = createContext(
                    `import { html } from '@esportsplus/template';\nlet el = html.virtual(list, (item) => html\`<li>\${() => item.name}</li>\`);`
                ),
                result = transform.transform(context),
                code = result.replacements![0].generate(context.sourceFile);

            expect(code).toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).toContain('list');
            expect(code).not.toContain(`${NAMESPACE}.ArraySlot`);
            expect(code).not.toContain('html.virtual');
            expect(result.prepend!.some(p => p.includes('<li>'))).toBe(true);
            expect(result.prepend!.some(p => p.includes(`${NAMESPACE}.template`))).toBe(true);
        });

        it('records the virtual entrypoint during matching', () => {
            let sourceFile = languageService.parse(process.cwd() + '/test.ts',
                    `import { html } from '@esportsplus/template';\nlet el = html.virtual(list, (item) => html\`<li>\${item}</li>\`);`
                ),
                calls = findTemplateArtifacts(sourceFile).calls;

            expect(calls).toHaveLength(1);
            expect(calls[0].entrypoint).toBe(ENTRYPOINT_VIRTUAL);
        });
    });

    describe('html.virtual() - options', () => {
        it('passes a third argument through to the standalone construction', () => {
            let context = createContext(
                    `import { html } from '@esportsplus/template';\nlet el = html.virtual(list, (item) => html\`<li>\${item}</li>\`, { anchor: 'end' });`
                ),
                result = transform.transform(context),
                code = result.replacements![0].generate(context.sourceFile);

            expect(code).toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).toContain(`{ anchor: 'end' }`);
        });

        it('passes a third argument through to the nested construction', () => {
            let sourceFile = languageService.parse(process.cwd() + '/test.ts',
                    `let x = html\`<div>\${html.virtual(items, (item) => html\`<span>\${item}</span>\`, { anchor: 'end' })}</div>\`;`
                ),
                result = generateCode(findTemplateArtifacts(sourceFile), sourceFile),
                code = result.replacements[0].generate(EMPTY);

            expect(code).toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).toContain(`{ anchor: 'end' }`);
        });
    });

    describe('html.virtual() - nested in a template', () => {
        it('generates a VirtualSlot for a virtual call in a node slot', () => {
            let sourceFile = languageService.parse(process.cwd() + '/test.ts',
                    `let x = html\`<div>\${html.virtual(items, (item) => html\`<span>\${item}</span>\`)}</div>\`;`
                ),
                result = generateCode(findTemplateArtifacts(sourceFile), sourceFile),
                code = result.replacements[0].generate(EMPTY);

            expect(code).toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).not.toContain(`${NAMESPACE}.ArraySlot`);
        });
    });

    describe('html.reactive() - unchanged', () => {
        it('still compiles to an ArraySlot construction', () => {
            let result = transform.transform(createContext(
                    `import { html } from '@esportsplus/template';\nlet el = html.reactive(items, (item) => html\`<li>\${item}</li>\`);`
                )),
                code = result.replacements![0].generate(EMPTY);

            expect(code).toContain(`${NAMESPACE}.ArraySlot`);
            expect(code).not.toContain(`${NAMESPACE}.VirtualSlot`);
            expect(code).not.toContain('html.reactive');
        });

        it('records the reactive entrypoint during matching', () => {
            let sourceFile = languageService.parse(process.cwd() + '/test.ts',
                    `import { html } from '@esportsplus/template';\nlet el = html.reactive(items, (item) => html\`<li>\${item}</li>\`);`
                ),
                calls = findTemplateArtifacts(sourceFile).calls;

            expect(calls).toHaveLength(1);
            expect(calls[0].entrypoint).toBe(ENTRYPOINT_REACTIVITY);
        });
    });

    describe('html.virtual pattern detection', () => {
        it('has a transform pattern', () => {
            expect(transform.patterns).toContain(`${ENTRYPOINT}.${ENTRYPOINT_VIRTUAL}`);
        });

        it('vite plugin requests a full reload for a source containing only html.virtual', async () => {
            let root = process.cwd().replace(/\\/g, '/'),
                file = join(root, 'src', '__virtual_only.ts'),
                send = vi.fn();

            writeFileSync(file, [
                `import { html } from '@esportsplus/template';`,
                `export const value = 1;`,
                `let el = html.virtual(items, row);`
            ].join('\n'));

            try {
                let instance = vite({ root });

                instance.configResolved({ command: 'serve', root, server: {} });

                let result = await instance.handleHotUpdate({
                    file,
                    modules: [{ isSelfAccepting: false }],
                    read: () => readFileSync(file, 'utf8'),
                    server: { ws: { send } }
                });

                expect(result).toEqual([]);
                expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
            }
            finally {
                unlinkSync(file);
            }
        });
    });
});
