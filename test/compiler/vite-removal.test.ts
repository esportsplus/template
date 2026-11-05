import { describe, expect, it, vi } from 'vitest';
import vite from '../../src/compiler/plugins/vite';


const SOURCE = [
    `import { html } from '@esportsplus/template';`,
    `export const panel = () => html\`<div onconnect=\${(element: HTMLElement) => {`,
    `    element.remove();`,
    `}}></div>\`;`
].join('\n');


async function transform(code: string, name: string, command: string = 'build') {
    let root = process.cwd().replace(/\\/g, '/'),
        instance = vite({ root }),
        warn = vi.fn();

    instance.configResolved({ command, root, server: {} });

    let result = await instance.transform.handler.call({ warn }, code, root + '/src/' + name);

    return { messages: warn.mock.calls.map(call => (call[0] as { message: string }).message), result };
}


describe('compiler/vite removal warnings', () => {
    it.each(['build', 'serve'])('warns through the plugin context in %s', async (command) => {
        let { messages, result } = await transform(SOURCE, `__removal_${command}.ts`, command);

        expect(result).not.toBeNull();
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatch(/^.*\/src\/__removal_\w+\.ts:3:5 `element\.remove` removes or replaces template-owned nodes/);
        expect(messages[0]).toContain(`README 'Removing template content'`);
    });

    it('reports the position in the source it was given when reactivity also compiles the module', async () => {
        let code = [
                `import { reactive } from '@esportsplus/reactivity';`,
                `let state = reactive({ open: false });`,
                SOURCE.split('\n').slice(0, 2).join('\n'),
                `    let other = element;`,
                `    if (state.open) { other.innerHTML = ''; }`,
                `}}></div>\`;`
            ].join('\n'),
            { messages, result } = await transform(code, '__removal_reactive.ts');

        expect(result!.code).not.toBe(code);
        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain('__removal_reactive.ts:6:23 `other.innerHTML`');
    });

    it('stays silent for raw DOM and when called without a plugin context', async () => {
        let raw = await transform([
                `import { html } from '@esportsplus/template';`,
                `let node = document.createElement('div');`,
                `node.remove();`,
                `export const view = () => html\`<div onconnect=\${() => node.remove()}></div>\`;`
            ].join('\n'), '__removal_raw.ts');

        expect(raw.messages).toEqual([]);

        let root = process.cwd().replace(/\\/g, '/'),
            instance = vite({ root });

        instance.configResolved({ command: 'build', root });

        await expect(instance.transform.handler(SOURCE, root + '/src/__removal_direct.ts')).resolves.not.toThrow();
    });
});
