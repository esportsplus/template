import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { ast } from '@esportsplus/typescript/compiler';
import { generateCode, rewriteExpression } from '../../src/compiler/codegen';
import { NAMESPACE } from '../../src/compiler/constants';
import { findHtmlTemplates, findReactiveCalls } from '../../src/compiler/ts-parser';


type TransformResult = {
    imports: string[];
    output: string;
    prepend: string[];
    replacements: { code: string; end: number; start: number }[];
};


function pipeline(source: string): TransformResult {
    let callRanges: { end: number; start: number }[] = [],
        callTemplates = new Map<string, string>(),
        imports: string[] = [],
        prepend: string[] = [],
        replacements: { code: string; end: number; start: number }[] = [],
        sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true),
        templates = findHtmlTemplates(sourceFile);

    let ranges: { end: number; start: number }[] = [];

    for (let i = 0, n = templates.length; i < n; i++) {
        ranges.push({
            end: templates[i].end,
            start: templates[i].start
        });
    }

    let calls = findReactiveCalls(sourceFile);

    for (let i = 0, n = calls.length; i < n; i++) {
        let call = calls[i];

        if (ast.inRange(ranges, call.start, call.end)) {
            continue;
        }

        callRanges.push({
            end: call.callbackArg.end,
            start: call.callbackArg.getStart(sourceFile)
        });

        let rewrittenCallback = rewriteExpression({
                sourceFile,
                templates: callTemplates
            }, call.callbackArg);

        replacements.push({
            code: `new ${NAMESPACE}.ArraySlot(\n                    ${call.arrayArg.getText(sourceFile)},\n                    ${rewrittenCallback}\n                )`,
            end: call.node.end,
            start: call.node.getStart(sourceFile)
        });
    }

    for (let [html, id] of callTemplates) {
        prepend.push(`const ${id} = ${NAMESPACE}.template(\`${html}\`);`);
    }

    if (templates.length > 0) {
        let result = generateCode(templates, sourceFile, undefined, callRanges);

        prepend.push(...result.prepend);

        for (let i = 0, n = result.replacements.length; i < n; i++) {
            let r = result.replacements[i];

            replacements.push({
                code: r.generate(sourceFile),
                end: r.node.end,
                start: r.node.getStart(sourceFile)
            });
        }

        imports.push('html');
    }

    // Apply replacements to source in reverse order to preserve positions
    let output = source;

    replacements.sort((a, b) => b.start - a.start);

    for (let i = 0, n = replacements.length; i < n; i++) {
        let r = replacements[i];

        output = output.slice(0, r.start) + r.code + output.slice(r.end);
    }

    // Prepend template factories
    if (prepend.length > 0) {
        output = prepend.join('\n') + '\n' + output;
    }

    return { imports, output, prepend, replacements };
}


describe('compiler/integration', () => {
    describe('static template - full pipeline', () => {
        it('produces correct replacement code for static template', () => {
            let source = `import { html } from '@esportsplus/template';\nlet el = html\`<div>hello</div>\`;`,
                { imports, output, prepend } = pipeline(source);

            expect(imports).toContain('html');
            expect(prepend.length).toBe(1);
            expect(prepend[0]).toContain(`${NAMESPACE}.template(\`<div>hello</div>\`)`);
            expect(output).not.toContain('html`');
            expect(output).toContain(`${NAMESPACE}.template(`);
        });
    });

    describe('template with expressions - full pipeline', () => {
        it('produces slot bindings for expressions', () => {
            let source = `import { html } from '@esportsplus/template';\nlet el = html\`<div>\${value}</div>\`;`,
                { output, prepend } = pipeline(source);

            expect(prepend.length).toBe(1);
            expect(output).toContain(`${NAMESPACE}.slot(`);
            expect(output).toContain('value');
            expect(output).not.toContain('html`');
        });
    });

    describe('template with events - full pipeline', () => {
        it('removes events from HTML and generates delegation code', () => {
            let source = `import { html } from '@esportsplus/template';\nlet el = html\`<button onclick=\${handler}>click</button>\`;`,
                { output, prepend } = pipeline(source);

            // Event attributes stripped from template HTML
            expect(prepend.length).toBe(1);
            expect(prepend[0]).not.toContain('onclick');
            expect(prepend[0]).toContain(`${NAMESPACE}.template(`);

            // Delegation code generated
            expect(output).toContain(`${NAMESPACE}.delegate(`);
            expect(output).toContain("'click'");
            expect(output).toContain('handler');
        });
    });

    describe('multiple templates in one file - full pipeline', () => {
        it('compiles all templates correctly', () => {
            let source = [
                    `import { html } from '@esportsplus/template';`,
                    `let a = html\`<div>first</div>\`;`,
                    `let b = html\`<span>second</span>\`;`
                ].join('\n'),
                { output, prepend, replacements } = pipeline(source);

            // Two different templates = two factories
            expect(prepend.length).toBe(2);
            expect(replacements.length).toBe(2);

            // Both rewritten - no html`` left
            expect(output).not.toContain('html`');

            // Both template factories present
            let hasFirst = prepend.some(p => p.includes('<div>first</div>')),
                hasSecond = prepend.some(p => p.includes('<span>second</span>'));

            expect(hasFirst).toBe(true);
            expect(hasSecond).toBe(true);
        });
    });

    describe('nested templates - full pipeline', () => {
        it('compiles outer and inner templates', () => {
            let source = `import { html } from '@esportsplus/template';\nlet el = html\`<div>\${html\`<span>inner</span>\`}</div>\`;`,
                { output, prepend } = pipeline(source);

            // Outer + inner = 2 template factories
            expect(prepend.length).toBe(2);

            let hasOuter = prepend.some(p => p.includes('<div>')),
                hasInner = prepend.some(p => p.includes('<span>inner</span>'));

            expect(hasOuter).toBe(true);
            expect(hasInner).toBe(true);

            // Nested html`` rewritten
            expect(output).not.toContain('html`');
            expect(output).toContain('insertBefore');
        });
    });

    describe('html.reactive() - full pipeline', () => {
        it('generates ArraySlot binding', () => {
            let source = `import { html } from '@esportsplus/template';\nlet el = html.reactive(items, (item) => html\`<li>\${item}</li>\`);`,
                { output, prepend } = pipeline(source);

            // Template factory for callback template
            expect(prepend.length).toBeGreaterThanOrEqual(1);

            let hasLi = prepend.some(p => p.includes('<li>'));

            expect(hasLi).toBe(true);

            // ArraySlot generated
            expect(output).toContain(`${NAMESPACE}.ArraySlot`);
            expect(output).toContain('items');
            expect(output).not.toContain('html.reactive');
        });
    });

    describe('no html templates - full pipeline', () => {
        it('produces no changes for source without templates', () => {
            let source = `let x = 1;\nlet y = 'hello';\nconsole.log(x + y);`,
                { imports, output, prepend, replacements } = pipeline(source);

            expect(imports).toHaveLength(0);
            expect(prepend).toHaveLength(0);
            expect(replacements).toHaveLength(0);
            expect(output).toBe(source);
        });
    });

    describe('mixed content - full pipeline', () => {
        it('only rewrites templates, preserves surrounding code', () => {
            let source = [
                    `import { html } from '@esportsplus/template';`,
                    `import { signal } from '@esportsplus/reactivity';`,
                    ``,
                    `let count = signal(0);`,
                    `let label = 'Counter';`,
                    ``,
                    `let el = html\`<div class=\${cls}>\${() => count()}</div>\`;`,
                    ``,
                    `console.log('done');`
                ].join('\n'),
                { output, prepend } = pipeline(source);

            // Template factory generated
            expect(prepend.length).toBe(1);

            // Non-template code preserved
            expect(output).toContain(`import { signal } from '@esportsplus/reactivity';`);
            expect(output).toContain(`let count = signal(0);`);
            expect(output).toContain(`let label = 'Counter';`);
            expect(output).toContain(`console.log('done');`);

            // Template rewritten
            expect(output).not.toContain('html`');
            expect(output).toContain(`${NAMESPACE}.setList(`);
            expect(output).toContain(`${NAMESPACE}.EffectSlot`);
        });
    });
});
