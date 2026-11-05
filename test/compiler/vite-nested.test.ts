import { describe, expect, it, vi } from 'vitest';

import vite from '../../src/compiler/plugins/vite';


const OTHER = "import { html } from '@esportsplus/template';\nexport const other = () => html`<p>other</p>`;";

const SOURCE = [
    `import { html } from '@esportsplus/template';`,
    `export const panel = () => html\`<div onconnect=\${(element: HTMLElement) => {`,
    `    element.remove();`,
    `}}></div>\`;`
].join('\n');


async function build(root: string) {
    let instance = vite({ root });

    instance.configResolved({ command: 'build', root, server: {} });
    instance.buildStart();

    return instance;
}


// A worker bundle is a nested build with fresh plugin instances transforming the outer build's modules again
describe('compiler/vite nested builds', () => {
    it('answers a nested build from the outer build, warning in both, and keeps compiling after it closes', async () => {
        let root = process.cwd().replace(/\\/g, '/'),
            id = root + '/src/__nested_panel.ts',
            outer = await build(root),
            nested = await build(root),
            warnings = { nested: vi.fn(), outer: vi.fn() };

        let first = await outer.transform.handler.call({ warn: warnings.outer }, SOURCE, id),
            second = await nested.transform.handler.call({ warn: warnings.nested }, SOURCE, id);

        expect(first!.code).toContain('.template(');
        expect(second!.code).toBe(first!.code);
        expect(warnings.outer).toHaveBeenCalledTimes(1);
        // Answered from the build cache: no plugin ran, but the host reports the kept removal warning again
        expect(warnings.nested).toHaveBeenCalledTimes(1);
        expect(warnings.nested.mock.calls[0][0]).toEqual(warnings.outer.mock.calls[0][0]);

        await nested.closeBundle();

        expect((await outer.transform.handler.call({ warn: warnings.outer }, OTHER, root + '/src/__nested_other.ts'))!.code).toContain('.template(');

        await outer.closeBundle();
    });
});
