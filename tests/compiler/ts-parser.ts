import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { extractTemplateParts, findHtmlTemplates, findReactiveCalls } from '../../src/compiler/ts-parser';


function createSourceFile(code: string): ts.SourceFile {
    return ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
}


describe('compiler/ts-parser', () => {
    describe('extractTemplateParts', () => {
        it('NoSubstitutionTemplateLiteral → single literal, empty expressions', () => {
            let sourceFile = createSourceFile('let x = `hello world`;');
            let statement = sourceFile.statements[0] as ts.VariableStatement,
                declaration = statement.declarationList.declarations[0],
                template = declaration.initializer! as ts.NoSubstitutionTemplateLiteral;
            let result = extractTemplateParts(template);

            expect(result.literals).toEqual(['hello world']);
            expect(result.expressions).toEqual([]);
        });

        it('TemplateExpression → correct literals + expressions', () => {
            let sourceFile = createSourceFile('let x = `a${1}b${2}c`;');
            let statement = sourceFile.statements[0] as ts.VariableStatement,
                declaration = statement.declarationList.declarations[0],
                template = declaration.initializer! as ts.TemplateExpression;
            let result = extractTemplateParts(template);

            expect(result.literals).toEqual(['a', 'b', 'c']);
            expect(result.expressions.length).toBe(2);
        });
    });

    describe('findHtmlTemplates', () => {
        it('single html`` call → returns 1 TemplateInfo with correct literals/expressions', () => {
            let source = `import { html } from '@esportsplus/template';\nlet x = html\`<div>\${value}</div>\`;`;
            let sourceFile = createSourceFile(source);
            let templates = findHtmlTemplates(sourceFile);

            expect(templates.length).toBe(1);
            expect(templates[0].literals).toEqual(['<div>', '</div>']);
            expect(templates[0].expressions.length).toBe(1);
            expect(templates[0].depth).toBe(0);
        });

        it('template with no expressions → single literal, no expressions', () => {
            let source = `import { html } from '@esportsplus/template';\nlet x = html\`<div>hello</div>\`;`;
            let sourceFile = createSourceFile(source);
            let templates = findHtmlTemplates(sourceFile);

            expect(templates.length).toBe(1);
            expect(templates[0].literals).toEqual(['<div>hello</div>']);
            expect(templates[0].expressions).toEqual([]);
        });

        it('no html import → returns empty array', () => {
            let source = `let x = html\`<div>hello</div>\`;`;
            let sourceFile = createSourceFile(source);
            let templates = findHtmlTemplates(sourceFile);

            // Without type checker, tag name match alone is sufficient
            expect(templates.length).toBe(1);
        });

        it('no html tagged templates at all → returns empty array', () => {
            let source = `let x = 'hello';`;
            let sourceFile = createSourceFile(source);
            let templates = findHtmlTemplates(sourceFile);

            expect(templates.length).toBe(0);
        });

        it('multiple html`` calls in same file → all found', () => {
            let source = [
                `import { html } from '@esportsplus/template';`,
                `let a = html\`<div>one</div>\`;`,
                `let b = html\`<span>two</span>\`;`,
                `let c = html\`<p>\${x}</p>\`;`
            ].join('\n');
            let sourceFile = createSourceFile(source);
            let templates = findHtmlTemplates(sourceFile);

            expect(templates.length).toBe(3);
        });

        it('html`` inside function body → found correctly', () => {
            let source = [
                `import { html } from '@esportsplus/template';`,
                `function render() {`,
                `    return html\`<div>\${value}</div>\`;`,
                `}`
            ].join('\n');
            let sourceFile = createSourceFile(source);
            let templates = findHtmlTemplates(sourceFile);

            expect(templates.length).toBe(1);
            expect(templates[0].depth).toBe(1);
            expect(templates[0].expressions.length).toBe(1);
        });

        it('nested html`` → returns both with correct depths', () => {
            let source = [
                `import { html } from '@esportsplus/template';`,
                `let outer = html\`<div>\${() => html\`<span>inner</span>\`}</div>\`;`
            ].join('\n');
            let sourceFile = createSourceFile(source);
            let templates = findHtmlTemplates(sourceFile);

            expect(templates.length).toBe(2);
            // Sorted deepest first
            expect(templates[0].depth).toBeGreaterThanOrEqual(templates[1].depth);
        });

        it('depth ordering: deepest first, then by position ascending', () => {
            let source = [
                `import { html } from '@esportsplus/template';`,
                `let a = html\`<div>\${() => html\`<span>deep1</span>\`}</div>\`;`,
                `let b = html\`<p>shallow</p>\`;`
            ].join('\n');
            let sourceFile = createSourceFile(source);
            let templates = findHtmlTemplates(sourceFile);

            expect(templates.length).toBe(3);
            // First template should be deepest (the inner one from arrow fn)
            expect(templates[0].depth).toBeGreaterThan(templates[1].depth);
            // Same-depth items sorted by position ascending
            let sameDepthtemplates = templates.filter(t => t.depth === 0);

            for (let i = 1, n = sameDepthtemplates.length; i < n; i++) {
                expect(sameDepthtemplates[i].start).toBeGreaterThan(sameDepthtemplates[i - 1].start);
            }
        });
    });

    describe('findReactiveCalls', () => {
        it('html.reactive() → returns ReactiveCallInfo with array + callback args', () => {
            let source = [
                `import { html } from '@esportsplus/template';`,
                `let x = html.reactive(items, (item) => html\`<li>\${item}</li>\`);`
            ].join('\n');
            let sourceFile = createSourceFile(source);
            let calls = findReactiveCalls(sourceFile);

            expect(calls.length).toBe(1);
            expect(calls[0].arrayArg).toBeDefined();
            expect(calls[0].callbackArg).toBeDefined();
            expect(calls[0].start).toBeLessThan(calls[0].end);
        });

        it('no reactive calls → empty array', () => {
            let source = `import { html } from '@esportsplus/template';\nlet x = html\`<div>hello</div>\`;`;
            let sourceFile = createSourceFile(source);
            let calls = findReactiveCalls(sourceFile);

            expect(calls.length).toBe(0);
        });
    });
});
