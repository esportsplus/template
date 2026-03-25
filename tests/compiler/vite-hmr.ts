import { describe, expect, it } from 'vitest';
import { NAMESPACE } from '../../src/compiler/constants';


// Reconstruct the same regex and injection logic from vite.ts for unit testing
// the regex replacement behavior in isolation
let TEMPLATE_SEARCH = NAMESPACE + '.template(',
    TEMPLATE_CALL_REGEX = new RegExp(
        '(const\\s+(\\w+)\\s*=\\s*' + NAMESPACE + '\\.template\\()(`)',
        'g'
    );

function injectHMR(code: string, id: string): string {
    let hmrId = id.replace(/\\/g, '/'),
        hotReplace = NAMESPACE + '.createHotTemplate("' + hmrId + '", "',
        injected = code.replace(TEMPLATE_CALL_REGEX, function(_match: string, prefix: string, varName: string, backtick: string) {
            return prefix.replace(TEMPLATE_SEARCH, hotReplace + varName + '", ') + backtick;
        });

    if (injected === code) {
        return code;
    }

    injected += '\nif (import.meta.hot) { import.meta.hot.accept(() => { ' + NAMESPACE + '.accept("' + hmrId + '"); }); }';

    return injected;
}


describe('compiler/vite-hmr', () => {
    describe('injectHMR', () => {
        it('returns unchanged code when no template calls found', () => {
            let code = 'let x = 1;',
                result = injectHMR(code, '/src/app.ts');

            expect(result).toBe(code);
        });

        it('replaces template() with createHotTemplate() for single template', () => {
            let code = 'const ' + NAMESPACE + '_t0 = ' + NAMESPACE + '.template(`<div>hello</div>`);',
                result = injectHMR(code, '/src/app.ts');

            expect(result).toContain(NAMESPACE + '.createHotTemplate("/src/app.ts", "' + NAMESPACE + '_t0", `<div>hello</div>`)');
            expect(result).not.toContain(NAMESPACE + '.template(');
        });

        it('replaces multiple template calls in same module', () => {
            let code = 'const tpl1 = ' + NAMESPACE + '.template(`<div>a</div>`);\n'
                      + 'const tpl2 = ' + NAMESPACE + '.template(`<span>b</span>`);',
                result = injectHMR(code, '/src/page.ts');

            expect(result).toContain('createHotTemplate("/src/page.ts", "tpl1", `<div>a</div>`)');
            expect(result).toContain('createHotTemplate("/src/page.ts", "tpl2", `<span>b</span>`)');
        });

        it('appends import.meta.hot.accept block', () => {
            let code = 'const tpl = ' + NAMESPACE + '.template(`<div></div>`);',
                result = injectHMR(code, '/src/app.ts');

            expect(result).toContain('if (import.meta.hot)');
            expect(result).toContain('import.meta.hot.accept');
            expect(result).toContain(NAMESPACE + '.accept("/src/app.ts")');
        });

        it('normalizes backslashes in module id', () => {
            let code = 'const tpl = ' + NAMESPACE + '.template(`<div></div>`);',
                result = injectHMR(code, 'C:\\Users\\dev\\src\\app.ts');

            expect(result).toContain('C:/Users/dev/src/app.ts');
            expect(result).not.toContain('\\');
        });

        it('does not append HMR code when no templates matched', () => {
            let code = 'let x = someFunction();',
                result = injectHMR(code, '/src/app.ts');

            expect(result).not.toContain('import.meta.hot');
        });

        it('preserves surrounding code', () => {
            let code = 'import something from "pkg";\n'
                      + 'const tpl = ' + NAMESPACE + '.template(`<div></div>`);\n'
                      + 'let x = tpl();',
                result = injectHMR(code, '/src/app.ts');

            expect(result).toContain('import something from "pkg";');
            expect(result).toContain('let x = tpl();');
        });

        it('handles template with complex html', () => {
            let code = 'const tpl = ' + NAMESPACE + '.template(`<div class="wrapper"><span><!--$--></span></div>`);',
                result = injectHMR(code, '/src/app.ts');

            expect(result).toContain('createHotTemplate');
            expect(result).toContain('<div class="wrapper"><span><!--$--></span></div>');
        });
    });

    describe('plugin behavior', () => {
        it('exported factory returns an object with expected HMR hooks', async () => {
            // Dynamic import to avoid compiler transformation issues
            let mod = await import('../../src/compiler/plugins/vite');
            let factory = mod.default;
            let plugin = factory();

            expect(typeof plugin.configResolved).toBe('function');
            expect(typeof plugin.transform).toBe('function');
            expect(typeof plugin.handleHotUpdate).toBe('function');
            expect(plugin.enforce).toBe('pre');
        });

        it('configResolved sets dev mode from config.command', async () => {
            let mod = await import('../../src/compiler/plugins/vite');
            let plugin = mod.default();

            // Should not throw
            plugin.configResolved({ command: 'serve', root: '/test' });
        });

        it('configResolved sets dev mode from config.mode', async () => {
            let mod = await import('../../src/compiler/plugins/vite');
            let plugin = mod.default();

            plugin.configResolved({ mode: 'development', root: '/test' });
        });

        it('transform returns null for non-template code', async () => {
            let mod = await import('../../src/compiler/plugins/vite');
            let plugin = mod.default();

            plugin.configResolved({ command: 'serve', root: '/test' });

            let result = plugin.transform('let x = 1;', '/src/test.ts');

            expect(result).toBeNull();
        });

        it('transform in production mode does not inject HMR', async () => {
            let mod = await import('../../src/compiler/plugins/vite');
            let plugin = mod.default();

            plugin.configResolved({ command: 'build', root: '/test' });

            let result = plugin.transform('let x = 1;', '/src/test.ts');

            // No templates, so null regardless
            expect(result).toBeNull();
        });

        it('handleHotUpdate is callable and does not throw', async () => {
            let mod = await import('../../src/compiler/plugins/vite');
            let plugin = mod.default();

            expect(() => {
                plugin.handleHotUpdate!({ file: '/src/app.ts', modules: [] });
            }).not.toThrow();
        });

        it('plugin has correct name', async () => {
            let mod = await import('../../src/compiler/plugins/vite');
            let plugin = mod.default();

            expect(plugin.name).toBeDefined();
            expect(typeof plugin.name).toBe('string');
        });

        it('plugin has watchChange function', async () => {
            let mod = await import('../../src/compiler/plugins/vite');
            let plugin = mod.default();

            expect(typeof plugin.watchChange).toBe('function');
        });
    });

    describe('plugin transform with HMR injection', () => {
        it('dev mode transform injects HMR for template code', async () => {
            let mod = await import('../../src/compiler/plugins/vite'),
                root = process.cwd().replace(/\\/g, '/'),
                plugin = mod.default({ root }),
                source = "import { html } from '@esportsplus/template';\nlet el = html`<div>hello</div>`;",
                fileId = root + '/src/__hmr_test.ts';

            plugin.configResolved({ command: 'serve', root });

            let result = plugin.transform(source, fileId);

            // The base plugin should compile the html template, then injectHMR
            // should replace template() calls with createHotTemplate() and append
            // import.meta.hot.accept block (vite.ts lines 33-45, 69-75)
            expect(result).not.toBeNull();
            expect(result!.code).toContain('createHotTemplate');
            expect(result!.code).toContain('import.meta.hot');
        });

        it('build mode transform does not inject HMR', async () => {
            let mod = await import('../../src/compiler/plugins/vite'),
                root = process.cwd().replace(/\\/g, '/'),
                plugin = mod.default({ root }),
                source = "import { html } from '@esportsplus/template';\nlet el = html`<div>hello</div>`;",
                fileId = root + '/src/__hmr_test.ts';

            plugin.configResolved({ command: 'build', root });

            let result = plugin.transform(source, fileId);

            // Should compile templates but NOT inject HMR in build mode
            if (result) {
                expect(result.code).not.toContain('createHotTemplate');
                expect(result.code).not.toContain('import.meta.hot');
            }
        });
    });
});
