import { writeFileSync, unlinkSync } from 'node:fs';
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

        it('does not self-accept unsupported modules', () => {
            let instance = plugin(root, { command: 'serve', server: {} }),
                result = instance.transform(UNSUPPORTED, id(root, '__hmr_unsupported.ts'));

            expect(result).not.toBeNull();
            expect(result!.code).not.toContain('import.meta.hot');
            expect(result!.code).not.toContain('@esportsplus/template/hmr');
            expect(result!.code).not.toContain('__hmr');
        });
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

        it('requests one full reload for unsupported template modules', async () => {
            let file = join(root, 'src', '__hmr_hot.ts'),
                send = vi.fn();

            writeFileSync(file, "import { html } from '@esportsplus/template';\nexport const value = 1;\nlet el = html`<div>hi</div>`;\n");

            try {
                let instance = plugin(root, { command: 'serve', server: {} }),
                    result = await instance.handleHotUpdate({
                        file,
                        modules: [{ isSelfAccepting: false }],
                        server: { ws: { send } }
                    });

                expect(result).toEqual([]);
                expect(send).toHaveBeenCalledTimes(1);
                expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
            }
            finally {
                unlinkSync(file);
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
