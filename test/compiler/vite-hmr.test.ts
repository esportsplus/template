import { describe, expect, it } from 'vitest';
import { NAMESPACE } from '../../src/compiler/constants';
import vite, { injectHMR } from '../../src/compiler/plugins/vite';


describe('compiler/vite-hmr', () => {
    describe('injectHMR', () => {
        it('returns unchanged code when no template calls found', () => {
            let code = 'let x = 1;';

            expect(injectHMR(code, '/src/app.ts')).toBe(code);
        });

        it('replaces template calls and accepts the module', () => {
            let code = 'const tpl = ' + NAMESPACE + '.template(`<div>hello</div>`);',
                result = injectHMR(code, '/src/app.ts');

            expect(result).toContain(NAMESPACE + '.createHotTemplate("/src/app.ts", "tpl", `<div>hello</div>`)');
            expect(result).toContain('import.meta.hot.accept');
            expect(result).toContain(NAMESPACE + '.accept("/src/app.ts")');
        });

        it('replaces every template call and normalizes module paths', () => {
            let code = 'const one = ' + NAMESPACE + '.template(`<div>a</div>`);\n'
                      + 'const two = ' + NAMESPACE + '.template(`<span>b</span>`);',
                result = injectHMR(code, 'C:\\src\\app.ts');

            expect(result).toContain('createHotTemplate("C:/src/app.ts", "one", `<div>a</div>`)');
            expect(result).toContain('createHotTemplate("C:/src/app.ts", "two", `<span>b</span>`)');
        });
    });

    describe('plugin behavior', () => {
        it('exposes Vite hooks without handleHotUpdate', () => {
            let plugin = vite();

            expect(typeof plugin.configResolved).toBe('function');
            expect(typeof plugin.transform).toBe('function');
            expect('handleHotUpdate' in plugin).toBe(false);
        });

        it('preserves the source map when injecting HMR', () => {
            let root = process.cwd().replace(/\\/g, '/'),
                plugin = vite({ root }),
                source = "import { html } from '@esportsplus/template';\nlet el = html`<div>hello</div>`;";

            plugin.configResolved({ command: 'serve', root });

            let result = plugin.transform(source, root + '/src/__hmr_test.ts');

            expect(result).not.toBeNull();
            expect(result!.code).toContain('createHotTemplate');
            expect(result!.map).not.toBeNull();
        });
    });
});
