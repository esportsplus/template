import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { ENTRYPOINT, ENTRYPOINT_REACTIVITY, NAMESPACE } from '../../src/compiler/constants';

import transform from '../../src/compiler';


function createContext(source: string) {
    let sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true);

    return { checker: undefined, sourceFile };
}


describe('compiler/transform', () => {
    describe('patterns', () => {
        it('has html` pattern', () => {
            expect(transform.patterns).toContain(`${ENTRYPOINT}\``);
        });

        it('has html.reactive pattern', () => {
            expect(transform.patterns).toContain(`${ENTRYPOINT}.${ENTRYPOINT_REACTIVITY}`);
        });

        it('has exactly 2 patterns', () => {
            expect(transform.patterns).toHaveLength(2);
        });
    });

    describe('transform - no templates', () => {
        it('returns empty result for code without templates', () => {
            let result = transform.transform(createContext('let x = 1;'));

            expect(result).toEqual({});
        });

        it('returns empty result for empty source', () => {
            let result = transform.transform(createContext(''));

            expect(result).toEqual({});
        });

        it('returns empty result for non-html tagged template', () => {
            let result = transform.transform(createContext('let x = css`div { color: red }`;'));

            expect(result).toEqual({});
        });
    });

    describe('transform - html templates', () => {
        it('returns imports/prepend/replacements for html template', () => {
            let result = transform.transform(createContext("let x = html`<div>hello</div>`;"));

            expect(result.imports).toBeDefined();
            expect(result.imports!.length).toBeGreaterThan(0);
            expect(result.prepend).toBeDefined();
            expect(result.prepend!.length).toBeGreaterThan(0);
            expect(result.replacements).toBeDefined();
            expect(result.replacements!.length).toBeGreaterThan(0);
        });

        it('import references correct package', () => {
            let result = transform.transform(createContext("let x = html`<div>hello</div>`;"));
            let imp = result.imports![0];

            expect(imp.namespace).toBe(NAMESPACE);
            expect(imp.remove).toContain(ENTRYPOINT);
        });

        it('prepend contains template factory definition', () => {
            let result = transform.transform(createContext("let x = html`<div>hello</div>`;"));
            let hasTemplate = result.prepend!.some(p => p.includes(NAMESPACE + '.template'));

            expect(hasTemplate).toBe(true);
        });

        it('replacement generates code for template', () => {
            let result = transform.transform(createContext("let x = html`<div>hello</div>`;"));
            let sourceFile = ts.createSourceFile('', '', ts.ScriptTarget.Latest);
            let code = result.replacements![0].generate(sourceFile);

            expect(code).toBeTruthy();
        });

        it('handles template with expression slot', () => {
            let result = transform.transform(createContext("let x = html`<div>${value}</div>`;"));
            let sourceFile = ts.createSourceFile('', '', ts.ScriptTarget.Latest);
            let code = result.replacements![0].generate(sourceFile);

            expect(code).toContain(NAMESPACE + '.slot(');
            expect(code).toContain('value');
        });

        it('handles multiple templates in one file', () => {
            let result = transform.transform(createContext(
                "let a = html`<div>first</div>`;\nlet b = html`<span>second</span>`;"
            ));

            expect(result.replacements!.length).toBe(2);
            expect(result.prepend!.length).toBe(2);
        });
    });

    describe('transform - html.reactive', () => {
        it('handles standalone html.reactive call', () => {
            let result = transform.transform(createContext(
                "let x = html.reactive(items, (item) => html`<li>${item}</li>`);"
            ));

            expect(result.replacements).toBeDefined();
            expect(result.replacements!.length).toBeGreaterThan(0);
        });

        it('prepends template definitions from reactive call callbacks', () => {
            let result = transform.transform(createContext(
                "let x = html.reactive(items, (item) => html`<li>${item}</li>`);"
            ));

            expect(result.prepend).toBeDefined();

            let hasTemplate = result.prepend!.some(p => p.includes(NAMESPACE + '.template'));

            expect(hasTemplate).toBe(true);
        });

        it('generates ArraySlot in replacement for reactive call', () => {
            let result = transform.transform(createContext(
                "let x = html.reactive(items, (item) => html`<li>${item}</li>`);"
            ));
            let sourceFile = ts.createSourceFile('', '', ts.ScriptTarget.Latest);
            let code = result.replacements![0].generate(sourceFile);

            expect(code).toContain(NAMESPACE + '.ArraySlot');
        });

        it('html.reactive inside html template is excluded from top-level calls', () => {
            let result = transform.transform(createContext(
                "let x = html`<div>${html.reactive(items, (item) => html`<li>${item}</li>`)}</div>`;"
            ));

            // The reactive call inside the template is handled by codegen, not as a standalone call
            // Should still have replacements (for the outer template)
            expect(result.replacements).toBeDefined();
            expect(result.replacements!.length).toBeGreaterThan(0);
        });
    });

    describe('transform - mixed content', () => {
        it('handles both html templates and standalone reactive calls', () => {
            let result = transform.transform(createContext(
                "let a = html`<div>static</div>`;\nlet b = html.reactive(items, (item) => html`<li>${item}</li>`);"
            ));

            expect(result.replacements).toBeDefined();
            // One for the template, one for the reactive call
            expect(result.replacements!.length).toBe(2);
        });
    });
});
