import { describe, expect, it, vi } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { languageService } from '@esportsplus/typescript/compiler';
import { PACKAGE_NAME, TYPES } from '../../src/compiler/constants';
import { analyze, fold, measure } from '../../src/compiler/ts-analyzer';
import { findTemplateArtifacts } from '../../src/compiler/ts-parser';


async function createExpression(code: string): Promise<ts.Expression> {
    let sourceFile = await languageService.parse(process.cwd() + '/test.ts', `let x = ${code};`);

    let statement = sourceFile.statements[0] as ts.VariableStatement,
        declaration = statement.declarationList.declarations[0];

    return declaration.initializer!;
}

async function createProgram(code: string): Promise<{ checker: ts.Checker; expr: ts.Expression }> {
    let { checker, sourceFile } = await languageService.scratch(process.cwd() + '/test.ts', code);

    let statements = sourceFile.statements,
        lastStatement = statements[statements.length - 1] as ts.VariableStatement,
        declaration = lastStatement.declarationList.declarations[0],
        expr = declaration.initializer!;

    return { checker, expr };
}

// `html` sites of the expression's file, as the transform harness (no checker) finds them
async function sitesOf(expr: ts.Expression): Promise<Set<ts.Node>> {
    return (await findTemplateArtifacts(expr.getSourceFile())).sites;
}

async function createProgramAndAnalyze(code: string): Promise<TYPES> {
    let { checker, expr } = await createProgram(code);

    return analyze(expr, await sitesOf(expr), await measure(checker, [expr]));
}

async function createProgramAndFold(code: string): Promise<string | null> {
    let { checker, expr } = await createProgram(code);

    return await fold(expr, checker);
}


describe('compiler/ts-analyzer', () => {
    describe('analyze - Effect detection', () => {
        it('identifies arrow function as Effect', async () => {
            let expr = await createExpression('() => "hello"');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });

        it('identifies arrow function with params as Effect', async () => {
            let expr = await createExpression('(x) => x * 2');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });

        it('identifies arrow function with block body as Effect', async () => {
            let expr = await createExpression('() => { return "hello"; }');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });

        it('identifies function expression as Effect', async () => {
            let expr = await createExpression('function() { return "hello"; }');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });

        it('identifies named function expression as Effect', async () => {
            let expr = await createExpression('function fn() { return "hello"; }');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });

        it('identifies async arrow function as Effect', async () => {
            let expr = await createExpression('async () => await fetch("")');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });
    });

    describe('analyze - Static detection', () => {
        it('identifies string literal as Static', async () => {
            let expr = await createExpression('"hello"');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });

        it('identifies numeric literal as Static', async () => {
            let expr = await createExpression('42');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });

        it('identifies true as Static', async () => {
            let expr = await createExpression('true');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });

        it('identifies false as Static', async () => {
            let expr = await createExpression('false');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });

        it('identifies null as Static', async () => {
            let expr = await createExpression('null');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });

        it('identifies undefined keyword as Static', async () => {
            // 'undefined' is an identifier, not a keyword, so without a checker it falls to Unknown
            let expr = await createExpression('undefined');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('identifies no-substitution template as Static', async () => {
            let expr = await createExpression('`hello`');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });
    });

    describe('analyze - Primitive detection', () => {
        it('identifies template expression as Primitive', async () => {
            let expr = await createExpression('`hello ${name}`');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Primitive);
        });

        it('identifies complex template expression as Primitive', async () => {
            let expr = await createExpression('`${a} + ${b} = ${c}`');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Primitive);
        });
    });

    describe('analyze - DocumentFragment detection', () => {
        it('identifies html tagged template as DocumentFragment', async () => {
            let sourceFile = await languageService.parse(process.cwd() + '/test.ts', `let x = html\`<div>hello</div>\`;`);

            let statement = sourceFile.statements[0] as ts.VariableStatement,
                declaration = statement.declarationList.declarations[0],
                expr = declaration.initializer!;

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.DocumentFragment);
        });
    });

    describe('analyze - ArraySlot detection', () => {
        it('identifies html.reactive call as ArraySlot', async () => {
            let sourceFile = await languageService.parse(process.cwd() + '/test.ts', `let x = html.reactive(items, (item) => html\`<li>\${item}</li>\`);`);

            let statement = sourceFile.statements[0] as ts.VariableStatement,
                declaration = statement.declarationList.declarations[0],
                expr = declaration.initializer!;

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.ArraySlot);
        });
    });

    describe('analyze - Conditional expressions', () => {
        it('identifies ternary with same types as that type', async () => {
            let expr = await createExpression('condition ? "a" : "b"');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });

        it('identifies ternary with Effect branch as Effect', async () => {
            let expr = await createExpression('condition ? () => "a" : "b"');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });

        it('identifies ternary with both Effect branches as Effect', async () => {
            let expr = await createExpression('condition ? () => "a" : () => "b"');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });

        it('identifies ternary with both Static branches as Static', async () => {
            let expr = await createExpression('condition ? 42 : "string"');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });

        it('identifies nested ternary correctly', async () => {
            let expr = await createExpression('a ? b ? () => c : () => d : () => e');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });
    });

    describe('analyze - Parenthesized expressions', () => {
        it('unwraps single parentheses', async () => {
            let expr = await createExpression('(() => "hello")');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });

        it('unwraps multiple parentheses', async () => {
            let expr = await createExpression('((("hello")))');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });

        it('unwraps parenthesized arrow function', async () => {
            let expr = await createExpression('((x) => x * 2)');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Effect);
        });
    });

    describe('analyze - Unknown detection', () => {
        it('identifies identifier as Unknown (without checker)', async () => {
            let expr = await createExpression('someVariable');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('identifies property access as Unknown (without checker)', async () => {
            let expr = await createExpression('obj.prop');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('identifies call expression as Unknown (without checker)', async () => {
            let expr = await createExpression('someFunction()');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('identifies object literal as Unknown', async () => {
            let expr = await createExpression('{ key: "value" }');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('identifies array literal as Unknown', async () => {
            let expr = await createExpression('[1, 2, 3]');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('identifies binary expression as Unknown', async () => {
            let expr = await createExpression('a + b');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });
    });

    describe('analyze - edge cases', () => {
        it('handles negative numbers', async () => {
            let expr = await createExpression('-42');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown); // UnaryExpression
        });

        it('handles float numbers', async () => {
            let expr = await createExpression('3.14');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Static);
        });

        it('handles bigint literal', async () => {
            let sourceFile = await languageService.parse(process.cwd() + '/test.ts', `let x = 9007199254740991n;`);

            let statement = sourceFile.statements[0] as ts.VariableStatement,
                declaration = statement.declarationList.declarations[0],
                expr = declaration.initializer!;

            // BigInt literals are not explicitly handled, so Unknown
            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('handles spread in array', async () => {
            let expr = await createExpression('[...items]');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('handles IIFE as Unknown', async () => {
            let expr = await createExpression('(() => "hello")()');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });
    });

    describe('analyze - ternary with mixed non-Effect types', () => {
        it('returns Unknown for ternary with Primitive and Static', async () => {
            let expr = await createExpression('condition ? `hello ${name}` : "static"');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('returns Unknown for ternary with Unknown and Static', async () => {
            let expr = await createExpression('condition ? someVar : 42');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });

        it('returns Unknown for ternary with Primitive and Unknown', async () => {
            let expr = await createExpression('condition ? `${a}` : someVar');

            expect(analyze(expr, await sitesOf(expr))).toBe(TYPES.Unknown);
        });
    });

    describe('analyze - isTypeFunction with type checker', () => {
        it('identifies typed function identifier as Effect', async () => {
            let result = await createProgramAndAnalyze(
                'declare const fn: () => void;\nlet target = fn;'
            );

            expect(result).toBe(TYPES.Effect);
        });

        it('identifies typed non-function identifier as Unknown', async () => {
            let result = await createProgramAndAnalyze(
                'declare const s: string;\nlet target = s;'
            );

            expect(result).toBe(TYPES.Unknown);
        });

        it('identifies property access to function type as Effect', async () => {
            let result = await createProgramAndAnalyze(
                'declare const obj: { method: () => void };\nlet target = obj.method;'
            );

            expect(result).toBe(TYPES.Effect);
        });

        it('identifies property access to non-function type as Unknown', async () => {
            let result = await createProgramAndAnalyze(
                'declare const obj: { value: number };\nlet target = obj.value;'
            );

            expect(result).toBe(TYPES.Unknown);
        });

        it('identifies call expression returning function as Effect', async () => {
            let result = await createProgramAndAnalyze(
                'declare function getHandler(): () => void;\nlet target = getHandler();'
            );

            expect(result).toBe(TYPES.Effect);
        });

        it('identifies union of all functions as Effect', async () => {
            let result = await createProgramAndAnalyze(
                'declare const fn: (() => void) | (() => string);\nlet target = fn;'
            );

            expect(result).toBe(TYPES.Effect);
        });

        it('identifies union of function and non-function as Unknown', async () => {
            let result = await createProgramAndAnalyze(
                'declare const mixed: (() => void) | string;\nlet target = mixed;'
            );

            expect(result).toBe(TYPES.Unknown);
        });

        it('identifies empty union as non-function (returns Unknown)', async () => {
            // never has zero call signatures and is not a union, so Unknown
            let result = await createProgramAndAnalyze(
                'declare const n: never;\nlet target = n;'
            );

            expect(result).toBe(TYPES.Unknown);
        });
    });

    describe('analyze - checker error handling', () => {
        it('warns and falls back to Unknown when the checker throws', async () => {
            let expr = await createExpression('someVariable'),
                spy = vi.spyOn(console, 'warn').mockImplementation(() => {}),
                throwingChecker = {
                    getTypeAtLocation() {
                        throw new Error('checker exploded');
                    }
                } as unknown as ts.Checker;

            let result = analyze(expr, await sitesOf(expr), await measure(throwingChecker, [expr]));

            expect(result).toBe(TYPES.Unknown);
            expect(spy).toHaveBeenCalledOnce();
            expect(spy.mock.calls[0][0]).toContain(PACKAGE_NAME);
            expect(spy.mock.calls[0][0]).toContain('someVariable');
            expect(spy.mock.calls[0][0]).toContain('checker exploded');

            spy.mockRestore();
        });
    });

    describe('fold - literals (no checker)', () => {
        it('folds a string literal', async () => {
            expect(await fold(await createExpression('"hello"'))).toBe('hello');
        });

        it('folds a no-substitution template literal', async () => {
            expect(await fold(await createExpression('`world`'))).toBe('world');
        });

        it('folds a numeric literal', async () => {
            expect(await fold(await createExpression('42'))).toBe('42');
        });

        it('folds a float literal', async () => {
            expect(await fold(await createExpression('3.14'))).toBe('3.14');
        });

        // Runtime bindings treat false as "render nothing / remove the attribute"; a folded
        // `disabled=${false}` would otherwise become a present `disabled=false` attribute
        it('never folds boolean keywords', async () => {
            expect(await fold(await createExpression('true'))).toBeNull();
            expect(await fold(await createExpression('false'))).toBeNull();
        });

        it('unwraps parentheses before folding', async () => {
            expect(await fold(await createExpression('((("hello")))'))).toBe('hello');
        });

        it('unwraps an as-const assertion before folding', async () => {
            expect(await fold(await createExpression('"hello" as const'))).toBe('hello');
        });

        it('unwraps a satisfies expression before folding', async () => {
            expect(await fold(await createExpression('"hello" satisfies string'))).toBe('hello');
        });

        it('does not fold a value containing an angle bracket', async () => {
            expect(await fold(await createExpression('"a<b"'))).toBeNull();
        });

        it('does not fold a value containing a quote', async () => {
            expect(await fold(await createExpression('"a&b"'))).toBeNull();
        });

        it('does not fold an identifier without a checker', async () => {
            expect(await fold(await createExpression('someVar'))).toBeNull();
        });

        it('does not fold an arrow function', async () => {
            expect(await fold(await createExpression('() => "hello"'))).toBeNull();
        });

        it('does not fold a template expression with substitutions', async () => {
            expect(await fold(await createExpression('`hi ${name}`'))).toBeNull();
        });
    });

    describe('fold - const resolution (checker)', () => {
        it('folds a const string identifier to its literal', async () => {
            expect(await createProgramAndFold('const greeting = "hello";\nlet target = greeting;')).toBe('hello');
        });

        it('folds a const numeric identifier to its literal', async () => {
            expect(await createProgramAndFold('const answer = 42;\nlet target = answer;')).toBe('42');
        });

        it('does not fold a let binding (widens to string)', async () => {
            expect(await createProgramAndFold('let greeting = "hello";\nlet target = greeting;')).toBeNull();
        });

        it('does not fold a non-literal typed binding (mirrors a function parameter)', async () => {
            expect(await createProgramAndFold('declare const label: string;\nlet target = label;')).toBeNull();
        });

        it('folds an as-const object property access', async () => {
            expect(await createProgramAndFold('const C = { a: "x" } as const;\nlet target = C.a;')).toBe('x');
        });

        it('does not fold a mutable object property access', async () => {
            expect(await createProgramAndFold('const C = { a: "x" };\nlet target = C.a;')).toBeNull();
        });

        it('does not fold a const whose value carries an unsafe character', async () => {
            expect(await createProgramAndFold('const c = "a<b" as const;\nlet target = c;')).toBeNull();
        });
    });
});
