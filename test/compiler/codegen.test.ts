import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { generateCode, rewriteExpression } from '../../src/compiler/codegen';
import { NAMESPACE } from '../../src/compiler/constants';
import { findHtmlTemplates } from '../../src/compiler/ts-parser';


function codegen(source: string) {
    let sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true),
        templates = findHtmlTemplates(sourceFile);

    return { result: generateCode(templates, sourceFile), sourceFile, templates };
}

// Runs codegen with a real checker so fold() can resolve const identifiers to their literal types
function codegenWithProgram(source: string) {
    let compilerOptions: ts.CompilerOptions = {
            lib: ['lib.es2020.d.ts'],
            noEmit: true,
            strict: true,
            target: ts.ScriptTarget.ES2020
        },
        host = ts.createCompilerHost(compilerOptions),
        originalFileExists = host.fileExists,
        originalReadFile = host.readFile;

    host.readFile = (fileName: string) => fileName === 'test.ts' ? source : originalReadFile.call(host, fileName);
    host.fileExists = (fileName: string) => fileName === 'test.ts' ? true : originalFileExists.call(host, fileName);

    let program = ts.createProgram(['test.ts'], compilerOptions, host),
        checker = program.getTypeChecker(),
        sourceFile = program.getSourceFile('test.ts')!,
        templates = findHtmlTemplates(sourceFile);

    return generateCode(templates, sourceFile, checker);
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
            expect(result.prepend[0]).toContain(`${NAMESPACE}.template(\`<div>hello\`)`);
            expect(result.replacements).toHaveLength(1);

            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain('()');
        });

        it('generates walker for static template with no slots', () => {
            let { result } = codegen(`let x = html\`<div>hello</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toMatch(/^[a-zA-Z_$][\w$]*\(\)$/);
        });
    });

    describe('generateCode - node slots', () => {
        it('generates slot binding for node expression', () => {
            let { result } = codegen(`let x = html\`<div>\${value}</div>\`;`);

            expect(result.replacements).toHaveLength(1);

            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.slot(`);
            expect(code).toContain('value');
            expect(code).toContain('return');
        });

        it('generates EffectSlot for arrow function expression', () => {
            let { result } = codegen(`let x = html\`<div>\${() => count}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.EffectSlot`);
        });

        it('inlines a string literal node into the template (no runtime text call)', () => {
            let { result } = codegen(`let x = html\`<div>\${"hello"}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).not.toContain(`${NAMESPACE}.text(`);
            expect(result.prepend[0]).toContain('hello');
            expect(code).toMatch(/^[a-zA-Z_$][\w$]*\(\)$/);
        });

        it('generates appendChild for nested html template in sole-child slot', () => {
            let { result } = codegen(`let x = html\`<div>\${html\`<span>nested</span>\`}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain('appendChild');
            expect(code).not.toContain('insertBefore');
        });

        it('generates insertBefore for nested html template in mid-position slot', () => {
            let { result } = codegen(`let x = html\`<div>\${html\`<span>nested</span>\`} tail</div>\`;`);
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

    describe('generateCode - delegated tuple handlers', () => {
        it('emits 4-argument delegate for [fn, data] handler', () => {
            let { result } = codegen(`let x = html\`<div onclick=\${[fn, data]}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.delegate(`);
            expect(code).toContain("'click', fn, data)");
        });

        it('emits 3-argument delegate (whole array) for 3-element array handler', () => {
            let { result } = codegen(`let x = html\`<div onclick=\${[fn, a, b]}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.delegate(`);
            expect(code).toContain('[fn, a, b]');
            expect(code).not.toContain("'click', fn, a");
        });

        it('emits 3-argument delegate for plain function handler', () => {
            let { result } = codegen(`let x = html\`<div onclick=\${handler}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain("'click', handler)");
        });
    });

    describe('generateCode - nested templates', () => {
        it('generates nested template with own factory', () => {
            let { result } = codegen(`let x = html\`<div>\${html\`<span>inner</span>\`}</div>\`;`);

            expect(result.templates.size).toBe(2);
            expect(result.prepend).toHaveLength(2);
        });

        it('rewrites nested html`` in expressions', () => {
            let { result } = codegen(`let x = html\`<div>\${condition ? html\`<span>a</span>\` : html\`<em>b</em>\`}</div>\`;`);

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

    describe('generateCode - sole-child ArraySlot', () => {
        it('emits the flagged construction for a sole-child reactive binding', () => {
            let { result } = codegen(`let x = html\`<table><tbody>\${html.reactive(items, (i) => html\`<tr>\${i}</tr>\`)}</tbody></table>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.ArraySlot`);
            expect(code).toContain(', true).fragment');
        });

        it('emits today\'s unflagged form when a text sibling precedes the binding', () => {
            let { result } = codegen(`let x = html\`<div>x\${html.reactive(items, (i) => html\`<span>\${i}</span>\`)}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.ArraySlot`);
            expect(code).not.toContain(', true)');
        });

        it('emits today\'s unflagged form when a sibling element precedes the binding', () => {
            let { result } = codegen(`let x = html\`<div><br>\${html.reactive(items, (i) => html\`<span>\${i}</span>\`)}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.ArraySlot`);
            expect(code).not.toContain(', true)');
        });

        it('emits today\'s unflagged form when a sibling element follows the binding', () => {
            let { result } = codegen(`let x = html\`<div>\${html.reactive(items, (i) => html\`<span>\${i}</span>\`)}<br></div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.ArraySlot`);
            expect(code).not.toContain(', true)');
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

        it('inlines a numeric literal node into the template (no runtime text call)', () => {
            let { result } = codegen(`let x = html\`<div>\${42}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).not.toContain(`${NAMESPACE}.text(`);
            expect(result.prepend[0]).toContain('42');
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

    describe('generateCode - spread attribute slots (object literal expansion)', () => {
        it('expands plain object literal into individual bindings', () => {
            let { result } = codegen(`let x = html\`<div \${{ id: 'test', class: 'foo' }}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setProperty(`);
            expect(code).toContain("'id'");
            expect(code).toContain(`${NAMESPACE}.setList(`);
            expect(code).toContain("'class'");
        });

        it('falls back to setProperties for object with spread assignment', () => {
            let { result } = codegen(`let x = html\`<div \${{ ...base, id: 'test' }}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setProperties(`);
        });

        it('expands shorthand property assignment', () => {
            let { result } = codegen(`let x = html\`<div \${{ className }}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setProperty(`);
            expect(code).toContain("'className'");
            expect(code).toContain('className');
        });

        it('falls back to setProperties for non-object expression', () => {
            let { result } = codegen(`let x = html\`<div \${props}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setProperties(`);
        });

        it('expands object with string literal property name', () => {
            let { result } = codegen(`let x = html\`<div \${{ 'data-value': val }}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setProperty(`);
            expect(code).toContain("'data-value'");
        });

        it('expands object with style property into setList', () => {
            let { result } = codegen(`let x = html\`<div \${{ style: sty }}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setList(`);
            expect(code).toContain("'style'");
        });

        it('expands object with event handler into delegate', () => {
            let { result } = codegen(`let x = html\`<div \${{ onclick: handler }}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.delegate(`);
            expect(code).toContain("'click'");
        });

        it('falls back to setProperties for computed property name', () => {
            let { result } = codegen(`let x = html\`<div \${{ [key]: val }}>text</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setProperties(`);
        });

        it('method declaration in object literal throws on print (EmitHint.Expression limitation)', () => {
            // MethodDeclaration is not an Expression node, so EmitHint.Expression printing throws
            expect(() => {
                codegen(`let x = html\`<div \${{ onclick() { return true; } }}>text</div>\`;`);
            }).toThrow();
        });
    });

    describe('generateCode - marker elision (sole/last-child slots)', () => {
        it('emits 3-arg EffectSlot (sole flag) for sole-child function slot', () => {
            let { result } = codegen(`let x = html\`<div>\${() => count}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.EffectSlot`);
            expect(code).toMatch(/,\s*1\)/);
        });

        it('emits 3-arg slot() (sole flag) for sole-child unknown slot', () => {
            let { result } = codegen(`let x = html\`<div>\${value}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.slot(`);
            expect(code).toMatch(/,\s*1\)/);
        });

        it('emits appendChild for sole-child ArraySlot slot', () => {
            let { result } = codegen(`let x = html\`<div>\${html.reactive(items, (item) => html\`<span>\${item}</span>\`)}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain('appendChild');
            expect(code).toContain(`${NAMESPACE}.ArraySlot`);
            expect(code).not.toContain('insertBefore');
        });

        it('inlines a sole-child string literal into the template (no slot, no text call)', () => {
            let { result } = codegen(`let x = html\`<div>\${"hello"}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).not.toContain('appendChild');
            expect(code).not.toContain(`${NAMESPACE}.text(`);
            expect(result.prepend[0]).toContain('hello');
        });

        it('emits 3-arg EffectSlot (last flag) for last-child slot after text', () => {
            let { result } = codegen(`let x = html\`<div>label \${() => count}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.EffectSlot`);
            expect(code).toMatch(/,\s*2\)/);
        });

        it('leaves mid-position slot in marker mode (2-arg, no flag)', () => {
            let { result } = codegen(`let x = html\`<div>\${value} tail</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.slot(`);
            expect(code).not.toContain('appendChild');
            expect(code).not.toMatch(/,\s*[12]\)/);
        });
    });

    describe('generateCode - arrow function body optimization', () => {
        it('generates template ID directly for parameterless arrow with static body', () => {
            let { result } = codegen(`let fn = () => html\`<div>static</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).not.toContain('()');
            expect(code).not.toContain('return');
        });

        it('generates IIFE for arrow with slots', () => {
            let { result } = codegen(`let fn = () => html\`<div>\${value}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain('{');
            expect(code).toContain('return');
        });
    });

    describe('generateCode - literal text abutting an attribute slot', () => {
        it('binds a class token with its prefix', () => {
            let { result } = codegen(`let x = html\`<div class="button button--\${modifier}">x</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.setList(`);
            expect(code).toContain(`"button--" + (modifier)`);
        });

        it('binds a property attribute with its prefix and suffix', () => {
            let { result } = codegen(`let x = html\`<a href="/users/\${id}/edit">x</a>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`"/users/" + (id) + "/edit"`);
        });

        it('emits one binding for several markers in one value', () => {
            let { result } = codegen(`let x = html\`<a href="/users/\${id}/edit/\${tab}">x</a>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`"/users/" + (id) + "/edit/" + (tab)`);
            expect(code.match(/setProperty\(/g)).toHaveLength(1);
        });

        it('emits a binding per class token', () => {
            let { result } = codegen(`let x = html\`<div class="a-\${one} b-\${two}">x</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`"a-" + (one)`);
            expect(code).toContain(`"b-" + (two)`);
        });

        it('parenthesizes a concatenated expression so precedence holds', () => {
            let { result } = codegen(`let x = html\`<div class="tab-\${active ? "on" : "off"}">x</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`"tab-" + (active ? "on" : "off")`);
        });

        it('leaves a slot owning the whole value unwrapped', () => {
            let { result } = codegen(`let x = html\`<div class="\${value}">x</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`'class', value)`);
            expect(code).not.toContain(' + ');
        });

        it('never concatenates an event binding', () => {
            let { result } = codegen(`let x = html\`<button onclick="\${handler}">x</button>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).not.toContain(' + ');
            expect(code).toContain(`'click'`);
        });
    });

    describe('generateCode - static inlining (fold)', () => {
        it('does not inline a literal containing an unsafe character', () => {
            let { result } = codegen(`let x = html\`<div>\${"a<b"}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).toContain(`${NAMESPACE}.text(`);
        });

        it('folds a literal attribute value into a static attribute (no setList emitted)', () => {
            let { result } = codegen(`let x = html\`<div class="static \${"foo"}">x</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).not.toContain(`${NAMESPACE}.setList(`);
            expect(result.prepend[0]).toContain('static foo');
        });

        it('inlines a const string identifier into the template (checker-resolved)', () => {
            let result = codegenWithProgram(`const greeting = "hello"; let x = html\`<div>\${greeting}</div>\`;`);
            let code = result.replacements[0].generate(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

            expect(code).not.toContain(`${NAMESPACE}.text(`);
            expect(result.prepend[0]).toContain('hello');
        });
    });
});
