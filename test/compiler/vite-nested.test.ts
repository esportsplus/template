import { describe, expect, it, vi } from 'vitest';

import vite from '../../src/compiler/plugins/vite';


const OTHER = "import { html } from '@esportsplus/template';\nexport const other = () => html`<p>other</p>`;";

const SOURCE = [
    `import { html } from '@esportsplus/template';`,
    `export const panel = () => html\`<div onconnect=\${(element: HTMLElement) => {`,
    `    element.remove();`,
    `}}></div>\`;`
].join('\n');


function build(root: string) {
    let instance = vite({ root });

    instance.configResolved({ command: 'build', root, server: {} });
    instance.buildStart();

    return instance;
}


// A worker bundle is a nested build with fresh plugin instances transforming the outer build's modules again
describe('compiler/vite nested builds', () => {
    it('answers a nested build from the outer build, warning once, and keeps compiling after it closes', async () => {
        let root = process.cwd().replace(/\\/g, '/'),
            id = root + '/src/__nested_panel.ts',
            outer = build(root),
            nested = build(root),
            warnings = { nested: vi.fn(), outer: vi.fn() };

        let first = outer.transform.handler.call({ warn: warnings.outer }, SOURCE, id),
            second = nested.transform.handler.call({ warn: warnings.nested }, SOURCE, id);

        expect(first!.code).toContain('.template(');
        expect(second!.code).toBe(first!.code);
        expect(warnings.outer).toHaveBeenCalledTimes(1);
        // Answered from the build cache: no plugin ran, so the removal is not reported again
        expect(warnings.nested).not.toHaveBeenCalled();

        // oxlint-disable-next-line typescript/await-thenable -- closeBundle() returns a promise from the next @esportsplus/typescript
        await nested.closeBundle();

        expect(outer.transform.handler.call({ warn: warnings.outer }, OTHER, root + '/src/__nested_other.ts')!.code).toContain('.template(');

        // oxlint-disable-next-line typescript/await-thenable -- closeBundle() returns a promise from the next @esportsplus/typescript
        await outer.closeBundle();
    });
});
