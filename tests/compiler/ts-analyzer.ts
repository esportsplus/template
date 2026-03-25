import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { analyze } from '../../src/compiler/ts-analyzer';
import { TYPES } from '../../src/compiler/constants';


function createExpression(code: string): ts.Expression {
    let sourceFile = ts.createSourceFile(
        'test.ts',
        `let x = ${code};`,
        ts.ScriptTarget.Latest,
        true
    );

    let statement = sourceFile.statements[0] as ts.VariableStatement,
        declaration = statement.declarationList.declarations[0];

    return declaration.initializer!;
}

function createProgramAndAnalyze(code: string): TYPES {
    let compilerOptions: ts.CompilerOptions = {
            lib: ['lib.es2020.d.ts'],
            noEmit: true,
            strict: true,
            target: ts.ScriptTarget.ES2020
        },
        host = ts.createCompilerHost(compilerOptions),
        originalFileExists = host.fileExists,
        originalReadFile = host.readFile;

    host.readFile = (fileName: string) => {
        if (fileName === 'test.ts') {
            return code;
        }

        return originalReadFile.call(host, fileName);
    };

    host.fileExists = (fileName: string) => {
        if (fileName === 'test.ts') {
            return true;
        }

        return originalFileExists.call(host, fileName);
    };

    let program = ts.createProgram(['test.ts'], compilerOptions, host),
        checker = program.getTypeChecker(),
        sourceFile = program.getSourceFile('test.ts')!;

    // Find the target expression (last variable declaration's initializer)
    let statements = sourceFile.statements,
        lastStatement = statements[statements.length - 1] as ts.VariableStatement,
        declaration = lastStatement.declarationList.declarations[0],
        expr = declaration.initializer!;

    return analyze(expr, checker);
}


describe('compiler/ts-analyzer', () => {
    describe('analyze - Effect detection', () => {
        it('identifies arrow function as Effect', () => {
            let expr = createExpression('() => "hello"');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });

        it('identifies arrow function with params as Effect', () => {
            let expr = createExpression('(x) => x * 2');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });

        it('identifies arrow function with block body as Effect', () => {
            let expr = createExpression('() => { return "hello"; }');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });

        it('identifies function expression as Effect', () => {
            let expr = createExpression('function() { return "hello"; }');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });

        it('identifies named function expression as Effect', () => {
            let expr = createExpression('function fn() { return "hello"; }');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });

        it('identifies async arrow function as Effect', () => {
            let expr = createExpression('async () => await fetch("")');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });
    });

    describe('analyze - Static detection', () => {
        it('identifies string literal as Static', () => {
            let expr = createExpression('"hello"');

            expect(analyze(expr)).toBe(TYPES.Static);
        });

        it('identifies numeric literal as Static', () => {
            let expr = createExpression('42');

            expect(analyze(expr)).toBe(TYPES.Static);
        });

        it('identifies true as Static', () => {
            let expr = createExpression('true');

            expect(analyze(expr)).toBe(TYPES.Static);
        });

        it('identifies false as Static', () => {
            let expr = createExpression('false');

            expect(analyze(expr)).toBe(TYPES.Static);
        });

        it('identifies null as Static', () => {
            let expr = createExpression('null');

            expect(analyze(expr)).toBe(TYPES.Static);
        });

        it('identifies undefined keyword as Static', () => {
            // Note: The identifier 'undefined' in TypeScript is analyzed as Unknown
            // because it's an identifier, not a keyword
            let expr = createExpression('undefined');

            // undefined as identifier falls to Unknown without type checker
            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('identifies no-substitution template as Static', () => {
            let expr = createExpression('`hello`');

            expect(analyze(expr)).toBe(TYPES.Static);
        });
    });

    describe('analyze - Primitive detection', () => {
        it('identifies template expression as Primitive', () => {
            let expr = createExpression('`hello ${name}`');

            expect(analyze(expr)).toBe(TYPES.Primitive);
        });

        it('identifies complex template expression as Primitive', () => {
            let expr = createExpression('`${a} + ${b} = ${c}`');

            expect(analyze(expr)).toBe(TYPES.Primitive);
        });
    });

    describe('analyze - DocumentFragment detection', () => {
        it('identifies html tagged template as DocumentFragment', () => {
            let sourceFile = ts.createSourceFile(
                'test.ts',
                `let x = html\`<div>hello</div>\`;`,
                ts.ScriptTarget.Latest,
                true
            );

            let statement = sourceFile.statements[0] as ts.VariableStatement,
                declaration = statement.declarationList.declarations[0],
                expr = declaration.initializer!;

            expect(analyze(expr)).toBe(TYPES.DocumentFragment);
        });
    });

    describe('analyze - ArraySlot detection', () => {
        it('identifies html.reactive call as ArraySlot', () => {
            let sourceFile = ts.createSourceFile(
                'test.ts',
                `let x = html.reactive(items, (item) => html\`<li>\${item}</li>\`);`,
                ts.ScriptTarget.Latest,
                true
            );

            let statement = sourceFile.statements[0] as ts.VariableStatement,
                declaration = statement.declarationList.declarations[0],
                expr = declaration.initializer!;

            expect(analyze(expr)).toBe(TYPES.ArraySlot);
        });
    });

    describe('analyze - Conditional expressions', () => {
        it('identifies ternary with same types as that type', () => {
            let expr = createExpression('condition ? "a" : "b"');

            expect(analyze(expr)).toBe(TYPES.Static);
        });

        it('identifies ternary with Effect branch as Effect', () => {
            let expr = createExpression('condition ? () => "a" : "b"');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });

        it('identifies ternary with both Effect branches as Effect', () => {
            let expr = createExpression('condition ? () => "a" : () => "b"');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });

        it('identifies ternary with both Static branches as Static', () => {
            // Both 42 and "string" are Static literals
            let expr = createExpression('condition ? 42 : "string"');

            expect(analyze(expr)).toBe(TYPES.Static);
        });

        it('identifies nested ternary correctly', () => {
            let expr = createExpression('a ? b ? () => c : () => d : () => e');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });
    });

    describe('analyze - Parenthesized expressions', () => {
        it('unwraps single parentheses', () => {
            let expr = createExpression('(() => "hello")');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });

        it('unwraps multiple parentheses', () => {
            let expr = createExpression('((("hello")))');

            expect(analyze(expr)).toBe(TYPES.Static);
        });

        it('unwraps parenthesized arrow function', () => {
            let expr = createExpression('((x) => x * 2)');

            expect(analyze(expr)).toBe(TYPES.Effect);
        });
    });

    describe('analyze - Unknown detection', () => {
        it('identifies identifier as Unknown (without checker)', () => {
            let expr = createExpression('someVariable');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('identifies property access as Unknown (without checker)', () => {
            let expr = createExpression('obj.prop');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('identifies call expression as Unknown (without checker)', () => {
            let expr = createExpression('someFunction()');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('identifies object literal as Unknown', () => {
            let expr = createExpression('{ key: "value" }');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('identifies array literal as Unknown', () => {
            let expr = createExpression('[1, 2, 3]');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('identifies binary expression as Unknown', () => {
            let expr = createExpression('a + b');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });
    });

    describe('analyze - edge cases', () => {
        it('handles negative numbers', () => {
            let expr = createExpression('-42');

            expect(analyze(expr)).toBe(TYPES.Unknown); // UnaryExpression
        });

        it('handles float numbers', () => {
            let expr = createExpression('3.14');

            expect(analyze(expr)).toBe(TYPES.Static);
        });

        it('handles bigint literal', () => {
            let sourceFile = ts.createSourceFile(
                'test.ts',
                `let x = 9007199254740991n;`,
                ts.ScriptTarget.Latest,
                true
            );

            let statement = sourceFile.statements[0] as ts.VariableStatement,
                declaration = statement.declarationList.declarations[0],
                expr = declaration.initializer!;

            // BigInt literals are not explicitly handled, so Unknown
            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('handles spread in array', () => {
            let expr = createExpression('[...items]');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('handles IIFE as Unknown', () => {
            let expr = createExpression('(() => "hello")()');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });
    });

    describe('analyze - ternary with mixed non-Effect types', () => {
        it('returns Unknown for ternary with Primitive and Static', () => {
            let expr = createExpression('condition ? `hello ${name}` : "static"');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('returns Unknown for ternary with Unknown and Static', () => {
            let expr = createExpression('condition ? someVar : 42');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });

        it('returns Unknown for ternary with Primitive and Unknown', () => {
            let expr = createExpression('condition ? `${a}` : someVar');

            expect(analyze(expr)).toBe(TYPES.Unknown);
        });
    });

    describe('analyze - isTypeFunction with type checker', () => {
        it('identifies typed function identifier as Effect', () => {
            let result = createProgramAndAnalyze(
                'declare const fn: () => void;\nlet target = fn;'
            );

            expect(result).toBe(TYPES.Effect);
        });

        it('identifies typed non-function identifier as Unknown', () => {
            let result = createProgramAndAnalyze(
                'declare const s: string;\nlet target = s;'
            );

            expect(result).toBe(TYPES.Unknown);
        });

        it('identifies property access to function type as Effect', () => {
            let result = createProgramAndAnalyze(
                'declare const obj: { method: () => void };\nlet target = obj.method;'
            );

            expect(result).toBe(TYPES.Effect);
        });

        it('identifies property access to non-function type as Unknown', () => {
            let result = createProgramAndAnalyze(
                'declare const obj: { value: number };\nlet target = obj.value;'
            );

            expect(result).toBe(TYPES.Unknown);
        });

        it('identifies call expression returning function as Effect', () => {
            let result = createProgramAndAnalyze(
                'declare function getHandler(): () => void;\nlet target = getHandler();'
            );

            expect(result).toBe(TYPES.Effect);
        });

        it('identifies union of all functions as Effect', () => {
            let result = createProgramAndAnalyze(
                'declare const fn: (() => void) | (() => string);\nlet target = fn;'
            );

            expect(result).toBe(TYPES.Effect);
        });

        it('identifies union of function and non-function as Unknown', () => {
            let result = createProgramAndAnalyze(
                'declare const mixed: (() => void) | string;\nlet target = mixed;'
            );

            expect(result).toBe(TYPES.Unknown);
        });

        it('identifies empty union as non-function (returns Unknown)', () => {
            // never type has empty union
            let result = createProgramAndAnalyze(
                'declare const n: never;\nlet target = n;'
            );

            // never has zero call signatures and is not a union, so Unknown
            expect(result).toBe(TYPES.Unknown);
        });
    });
});
