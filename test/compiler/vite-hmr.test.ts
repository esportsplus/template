import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import vite from '../../src/compiler/plugins/vite';


const EAGER = [
    `import { html } from '@esportsplus/template';`,
    `export default html\`<div>hello</div>\`;`
].join('\n');

const FACTORY = [
    `import { html } from '@esportsplus/template';`,
    `const factory = (type: string) => {`,
    `    function template(this: any, label?: string) {`,
    '        return html`<div class="${type}">${label ?? \'\'}</div>`;',
    `    }`,
    `    return template;`,
    `};`,
    `export default factory('checkbox');`,
    `export { factory };`
].join('\n');

const UNSUPPORTED = [
    `import { html } from '@esportsplus/template';`,
    `export const value = 1;`,
    `let el = html\`<div>hello</div>\`;`
].join('\n');

const ROUTE_FACTORY = [
    `import { html } from '@esportsplus/template';`,
    `type Router = { get(config: object): Router };`,
    `export default (r: Router) => r.get({ path: '/x', handler: () => html\`<div>page</div>\` });`
].join('\n');


function id(root: string, name: string): string {
    return root + '/src/' + name;
}

function plugin(root: string, config: Record<string, unknown>) {
    let instance = vite({ root });

    instance.configResolved({ root, ...config });
    return instance;
}


describe('compiler/vite-hmr', () => {
    let root = process.cwd().replace(/\\/g, '/');

    describe('dev transform', () => {
        it('wraps an eager default export and self-accepts', () => {
            let instance = plugin(root, { command: 'serve', server: {} }),
                result = instance.transform(EAGER, id(root, '__hmr_eager.ts'));

            expect(result).not.toBeNull();
            expect(result!.code).toContain('@esportsplus/template/hmr');
            expect(result!.code).toContain('.eager(');
            expect(result!.code).toContain('import.meta.hot.accept(');
            expect(result!.code).toContain('import.meta.hot.dispose(');
            expect(result!.code).toContain('import.meta.hot.prune(');
            expect(result!.code).toContain('__hmr');
        });

        it('wraps a factory default and its named export', () => {
            let instance = plugin(root, { command: 'serve', server: {} }),
                result = instance.transform(FACTORY, id(root, '__hmr_factory.ts'));

            expect(result).not.toBeNull();
            expect(result!.code).toContain('@esportsplus/template/hmr');
            expect(result!.code).toContain('.factory(');
            expect(result!.code).toContain('.callable(');
            expect(result!.code).toContain('as factory');
            expect(result!.code).toContain('import.meta.hot.accept(');
            expect(result!.code).toContain('__hmr');
        });

        // HMR edits land after the sourcemap is built: any line they add before user code would
        // shift every later mapping, so dev output must keep build output's line layout
        it('keeps the line layout of the non-HMR output', () => {
            let source = FACTORY + '\nconst marker = 1;',
                build = plugin(root, { command: 'build' }).transform(source, id(root, '__hmr_layout_build.ts'))!.code.split('\n'),
                serve = plugin(root, { command: 'serve', server: {} }).transform(source, id(root, '__hmr_layout_serve.ts'))!.code.split('\n');

            expect(serve.join('\n')).toContain('import.meta.hot.accept(');
            expect(serve.findIndex(line => line.includes('const marker'))).toBe(build.findIndex(line => line.includes('const marker')));
        });

        it('does not self-accept unsupported modules', () => {
            let instance = plugin(root, { command: 'serve', server: {} }),
                result = instance.transform(UNSUPPORTED, id(root, '__hmr_unsupported.ts'));

            expect(result).not.toBeNull();
            expect(result!.code).not.toContain('import.meta.hot');
            expect(result!.code).not.toContain('@esportsplus/template/hmr');
            expect(result!.code).not.toContain('__hmr');
        });

        it('does not wrap a route factory whose default returns a non-renderable', () => {
            let instance = plugin(root, { command: 'serve', server: {} }),
                result = instance.transform(ROUTE_FACTORY, id(root, '__hmr_route.ts'));

            expect(result).not.toBeNull();
            expect(result!.code).not.toContain('.factory(');
            expect(result!.code).not.toContain('@esportsplus/template/hmr');
            expect(result!.code).not.toContain('import.meta.hot');
        });

        it.each([
            `export default (r: Router<Renderable<unknown>>) => r.get({ responder: () => html\`<div>page</div>\` });`,
            `export default function route(r: Router<Renderable<unknown>>) { return r.get({ responder: () => html\`<div>page</div>\` }); }`,
            `const route = (r: Router<Renderable<unknown>>) => r.get({ responder: () => html\`<div>page</div>\` }); export { route as default };`,
            `export default (element: Element): number => element.childNodes.length;`,
            `export default (): TextController => ({ value: 'text' });`
        ])('does not classify nested type arguments or parameter types as renderable: %s', (declaration) => {
            let code = [
                    `import { html, type Renderable } from '@esportsplus/template';`,
                    `type Router<T> = { get(config: { responder: () => T }): Router<T> };`,
                    `type TextController = { value: string };`,
                    `const page = () => html\`<div>page</div>\`;`,
                    declaration
                ].join('\n'),
                instance = plugin(root, { command: 'serve', server: {} }),
                result = instance.transform(code, id(root, '__hmr_generic_route.ts'));

            expect(result).not.toBeNull();
            expect(result!.code).not.toContain('@esportsplus/template/hmr');
            expect(result!.code).not.toContain('import.meta.hot');
        });

        it.each(['DocumentFragment', 'HTMLDivElement', 'Text', 'Renderable<unknown>', 'Node | null', 'NodeList', 'DocumentFragment[]'])(
            'still wraps a component returning %s', (returnType) => {
                let code = [
                        `import { html, type Renderable } from '@esportsplus/template';`,
                        `export default (): ${returnType} => html\`<div>page</div>\` as ${returnType};`
                    ].join('\n'),
                    instance = plugin(root, { command: 'serve', server: {} }),
                    result = instance.transform(code, id(root, '__hmr_return_type.ts'));

                expect(result!.code).toContain('.factory(');
                expect(result!.code).toContain('import.meta.hot.accept(');
            }
        );
    });

    describe('handleHotUpdate', () => {
        it('leaves CSS/SCSS untouched', async () => {
            let instance = plugin(root, { command: 'serve', server: {} }),
                result = await instance.handleHotUpdate({
                    file: root + '/src/style.scss',
                    modules: [],
                    server: { ws: { send: vi.fn() } }
                });

            expect(result).toBeUndefined();
        });

        it('lets self-accepting modules proceed', async () => {
            let instance = plugin(root, { command: 'serve', server: {} }),
                result = await instance.handleHotUpdate({
                    file: root + '/src/component.ts',
                    modules: [{ isSelfAccepting: true }],
                    server: { ws: { send: vi.fn() } }
                });

            expect(result).toBeUndefined();
        });

        // An isolated project: parallel workers never see this module in their program
        it('requests one full reload for unsupported template modules', async () => {
            let fixture = mkdtempSync(join(process.cwd(), '.fixture-hmr-')).replace(/\\/g, '/'),
                file = fixture + '/hot.ts',
                send = vi.fn();

            let source = "import { html } from '@esportsplus/template';\nexport const value = 1;\nlet el = html`<div>hi</div>`;\n";

            writeFileSync(file, source);
            writeFileSync(fixture + '/tsconfig.json', JSON.stringify({
                compilerOptions: { module: 'esnext', moduleResolution: 'bundler', strict: true, target: 'esnext', types: [] },
                files: ['./hot.ts']
            }));

            try {
                let instance = plugin(fixture, { command: 'serve', server: {} });

                instance.transform(source, file);

                let result = await instance.handleHotUpdate({
                        file,
                        modules: [{ isSelfAccepting: false }],
                        read: () => readFileSync(file, 'utf8'),
                        server: { ws: { send } }
                    });

                expect(result).toEqual([]);
                expect(send).toHaveBeenCalledTimes(1);
                expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
            }
            finally {
                rmSync(fixture, { force: true, recursive: true });
            }
        });
    });

    describe('production isolation', () => {
        it('emits no HMR in build mode', () => {
            let instance = plugin(root, { command: 'build' }),
                result = instance.transform(EAGER, id(root, '__hmr_prod.ts'));

            expect(result).not.toBeNull();
            expect(result!.code).not.toContain('import.meta.hot');
            expect(result!.code).not.toContain('@esportsplus/template/hmr');
            expect(result!.code).not.toContain('.eager(');
            expect(result!.code).not.toContain('.factory(');
            expect(result!.code).not.toContain('__hmr');
        });

        it('emits no HMR for `vite build --mode development`', () => {
            let instance = plugin(root, { command: 'build', mode: 'development' }),
                result = instance.transform(FACTORY, id(root, '__hmr_prod_dev_mode.ts'));

            expect(result).not.toBeNull();
            expect(result!.code).not.toContain('import.meta.hot');
            expect(result!.code).not.toContain('@esportsplus/template/hmr');
            expect(result!.code).not.toContain('.factory(');
            expect(result!.code).not.toContain('__hmr');
        });

        it('emits no HMR for SSR transforms', () => {
            let instance = plugin(root, { command: 'serve', server: {} }),
                result = instance.transform(EAGER, id(root, '__hmr_ssr.ts'), { ssr: true });

            expect(result).not.toBeNull();
            expect(result!.code).not.toContain('import.meta.hot');
            expect(result!.code).not.toContain('@esportsplus/template/hmr');
            expect(result!.code).not.toContain('__hmr');
        });

        it('does not expose the hmr runtime from the production entry', async () => {
            let entry = await import('../../src/index');

            expect('accept' in entry).toBe(false);
            expect('factory' in entry).toBe(false);
            expect('eager' in entry).toBe(false);
        });
    });
});
