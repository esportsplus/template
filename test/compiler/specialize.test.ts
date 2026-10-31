// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { languageService } from '@esportsplus/typescript/compiler';
import { specialize } from '../../src/compiler/specialize';
import { findTemplateArtifacts } from '../../src/compiler/ts-parser';


const SOURCE = [
    "function view(type: 'a' | 'b', label: string) {",
    '    let first = html`<p class="${type}">${label}</p>`;',
    '    return [first, html`<i title="${type}">${label}</i>`];',
    '}'
].join('\n');


function setup(source: string) {
    let { checker, sourceFile } = languageService.scratch(process.cwd() + '/specialize-fixture.ts', source);

    return { checker, templates: findTemplateArtifacts(sourceFile).templates };
}


describe('compiler/specialize', () => {
    it('remembers per parameter whether it is reassigned, for the next template under the function', () => {
        let { checker, templates } = setup(SOURCE),
            immutables = new Map<ts.Symbol, boolean>();

        expect(specialize(templates[0].expressions, immutables, checker)).toHaveLength(2);
        expect([...immutables.values()]).toEqual([true]);

        // The answer is taken from the map, not found again by walking the function
        immutables.set([...immutables.keys()][0], false);

        expect(specialize(templates[1].expressions, immutables, checker)).toEqual([]);
    });

    it('does not specialize a parameter the function reassigns', () => {
        let { checker, templates } = setup(SOURCE.replace('let first', "type = 'b';\n    let first")),
            immutables = new Map<ts.Symbol, boolean>();

        expect(specialize(templates[0].expressions, immutables, checker)).toEqual([]);
        expect([...immutables.values()]).toEqual([false]);
    });
});
