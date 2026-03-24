import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { generateCode, rewriteExpression } from '../../src/compiler/codegen';
import { findHtmlTemplates } from '../../src/compiler/ts-parser';
import { NAMESPACE } from '../../src/compiler/constants';


function codegen(source: string) {
    let sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true),
        templates = findHtmlTemplates(sourceFile);

    return { result: generateCode(templates, sourceFile), sourceFile, templates };
}


describe('compiler/codegen', () => {
    describe('generateCode - static templates', () => {
        it('returns empty result for no templates', () => {
            let { result } = codegen('let x = 1;');

            expect(result.prepend).toHaveLength(0);
            expect(result.replacements).toHaveLength(0);
            expect(result.templates.size).toBe(0);
        });

        it('generates template factory for static template', () => {
            let { result } = codegen(`let x = html\`<div>hello</div>\`;`);

            expect(result.templates.size).toBe(1);
            expect(result.prepend).toHaveLength(1);
            expect(result.prepend[0]).toContain(`${NAMESPACE}.template(\`<div>hello</div>\`)`);
            expect(result.replacements).toHaveLength(1);

            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain('()');
        });

        it('generates walker for static template with no slots', () => {
            let { result } = codegen(`let x = html\`<div>hello</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            // Static template without slots just calls the template factory
            expect(code).toMatch(/^[a-zA-Z_$][\w$]*\(\)$/);
        });
    });

    describe('generateCode - node slots', () => {
        it('generates slot binding for node expression', () => {
            let { result } = codegen(`let x = html\`<div>\${value}</div>\`;`);

            expect(result.replacements).toHaveLength(1);

            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            // Should contain slot() call for unknown type expression
            expect(code).toContain(`${NAMESPACE}.slot(`);
            expect(code).toContain('value');
            expect(code).toContain('return');
        });

        it('generates EffectSlot for arrow function expression', () => {
            let { result } = codegen(`let x = html\`<div>\${() => count}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.EffectSlot`);
        });

        it('generates static text binding for string literal', () => {
            let { result } = codegen(`let x = html\`<div>\${"hello"}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.text(`);
            expect(code).toContain('"hello"');
        });

        it('generates insertBefore for nested html template', () => {
            let { result } = codegen(`let x = html\`<div>\${html\`<span>nested</span>\`}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain('insertBefore');
        });

        it('generates multiple node bindings', () => {
            let { result } = codegen(`let x = html\`<div>\${a}</div><span>\${b}</span>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain('a');
            expect(code).toContain('b');
        });
    });

    describe('generateCode - attribute slots', () => {
        it('generates setProperty for attribute binding', () => {
            let { result } = codegen(`let x = html\`<div id=\${value}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setProperty(`);
            expect(code).toContain("'id'");
            expect(code).toContain('value');
        });

        it('generates setList for class binding', () => {
            let { result } = codegen(`let x = html\`<div class=\${cls}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setList(`);
            expect(code).toContain("'class'");
        });

        it('generates setList for style binding', () => {
            let { result } = codegen(`let x = html\`<div style=\${sty}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setList(`);
            expect(code).toContain("'style'");
        });
    });

    describe('generateCode - event attributes', () => {
        it('generates delegate for standard event', () => {
            let { result } = codegen(`let x = html\`<div onclick=\${handler}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.delegate(`);
            expect(code).toContain("'click'");
        });

        it('generates direct attach for focus event', () => {
            let { result } = codegen(`let x = html\`<div onfocus=\${handler}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.on(`);
            expect(code).toContain("'focus'");
        });

        it('generates lifecycle call for onconnect', () => {
            let { result } = codegen(`let x = html\`<div onconnect=\${handler}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.onconnect(`);
        });

        it('generates lifecycle call for onresize', () => {
            let { result } = codegen(`let x = html\`<div onresize=\${handler}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.onresize(`);
        });
    });

    describe('generateCode - nested templates', () => {
        it('generates nested template with own factory', () => {
            let { result } = codegen(`let x = html\`<div>\${html\`<span>inner</span>\`}</div>\`;`);

            // Outer template + inner template
            expect(result.templates.size).toBe(2);
            expect(result.prepend).toHaveLength(2);
        });

        it('rewrites nested html`` in expressions', () => {
            let { result } = codegen(`let x = html\`<div>\${condition ? html\`<span>a</span>\` : html\`<em>b</em>\`}</div>\`;`);

            // Outer + 2 inner templates
            expect(result.templates.size).toBe(3);
            expect(result.prepend).toHaveLength(3);
        });
    });

    describe('generateCode - html.reactive()', () => {
        it('generates ArraySlot for reactive call in node slot', () => {
            let { result } = codegen(`let x = html\`<div>\${html.reactive(items, (item) => html\`<span>\${item}</span>\`)}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.ArraySlot`);
        });
    });

    describe('generateCode - mixed slots', () => {
        it('handles attribute + node slots on same element', () => {
            let { result } = codegen(`let x = html\`<div class=\${cls}>\${content}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setList(`);
            expect(code).toContain(`${NAMESPACE}.slot(`);
        });

        it('handles multiple attribute slots on same element', () => {
            let { result } = codegen(`let x = html\`<div id=\${id} class=\${cls}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setProperty(`);
            expect(code).toContain(`${NAMESPACE}.setList(`);
        });
    });

    describe('generateCode - template deduplication', () => {
        it('deduplicates identical template literals', () => {
            let { result } = codegen(`let a = html\`<div>same</div>\`; let b = html\`<div>same</div>\`;`);

            // Same HTML should produce only one template factory
            expect(result.templates.size).toBe(1);
            expect(result.prepend).toHaveLength(1);
            expect(result.replacements).toHaveLength(2);
        });

        it('creates separate templates for different HTML', () => {
            let { result } = codegen(`let a = html\`<div>one</div>\`; let b = html\`<span>two</span>\`;`);

            expect(result.templates.size).toBe(2);
            expect(result.prepend).toHaveLength(2);
        });
    });

    describe('generateCode - expression type detection', () => {
        it('generates EffectSlot for function expression node', () => {
            let { result } = codegen(`let x = html\`<div>\${function() { return 1; }}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.EffectSlot`);
        });

        it('generates slot() for unknown identifier', () => {
            let { result } = codegen(`let x = html\`<div>\${someVar}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.slot(`);
        });

        it('generates text() for numeric literal', () => {
            let { result } = codegen(`let x = html\`<div>\${42}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.text(`);
        });
    });

    describe('rewriteExpression', () => {
        it('rewrites nested html template in expression', () => {
            let source = `let x = html\`<div>\${html\`<span>inner</span>\`}</div>\`;`,
                sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true),
                templates = findHtmlTemplates(sourceFile);

            let ctx = {
                sourceFile,
                templates: new Map<string, string>()
            };

            let expr = templates[0].expressions[0],
                rewritten = rewriteExpression(ctx, expr);

            // Nested html`` should be rewritten to template factory call
            expect(rewritten).not.toContain('html`');
        });

        it('prints plain expression as-is', () => {
            let source = `let x = html\`<div>\${value}</div>\`;`,
                sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true),
                templates = findHtmlTemplates(sourceFile);

            let ctx = {
                sourceFile,
                templates: new Map<string, string>()
            };

            let expr = templates[0].expressions[0],
                rewritten = rewriteExpression(ctx, expr);

            expect(rewritten).toBe('value');
        });
    });

    describe('generateCode - arrow function body optimization', () => {
        it('generates template ID directly for parameterless arrow with static body', () => {
            let { result } = codegen(`let fn = () => html\`<div>static</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            // Should be just the template ID (no () call, no IIFE)
            expect(code).not.toContain('()');
            expect(code).not.toContain('return');
        });

        it('generates IIFE for arrow with slots', () => {
            let { result } = codegen(`let fn = () => html\`<div>\${value}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            // Arrow body with slots uses block syntax
            expect(code).toContain('{');
            expect(code).toContain('return');
        });
    });
});
