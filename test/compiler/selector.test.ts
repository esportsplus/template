import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { selectorComparison } from '../../src/compiler/ts-analyzer';

import transform from '../../src/compiler';


function createCheckerContext(source: string) {
    let fileName = 'selector-test.ts',
        sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true),
        host: ts.CompilerHost = {
            fileExists: (f) => f === fileName,
            getCanonicalFileName: (f) => f,
            getCurrentDirectory: () => '',
            getDefaultLibFileName: () => 'lib.d.ts',
            getNewLine: () => '\n',
            getSourceFile: (f) => (f === fileName ? sourceFile : undefined),
            readFile: () => undefined,
            useCaseSensitiveFileNames: () => true,
            writeFile: () => {}
        },
        program = ts.createProgram([fileName], { noLib: true, target: ts.ScriptTarget.Latest }, host);

    return { checker: program.getTypeChecker(), sourceFile: program.getSourceFile(fileName)! };
}

function createContext(source: string) {
    let sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true);

    return { checker: undefined, sourceFile };
}

function findBinary(node: ts.Node): ts.BinaryExpression | undefined {
    if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
            node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
    ) {
        return node;
    }

    let found: ts.BinaryExpression | undefined;

    ts.forEachChild(node, (child) => {
        if (!found) {
            found = findBinary(child);
        }
    });

    return found;
}

function generatedCode(source: string): string {
    let dummy = ts.createSourceFile('', '', ts.ScriptTarget.Latest),
        result = transform.transform(createContext(source));

    return (result.replacements || []).map((r) => r.generate(dummy)).join('\n');
}

function signalIntent(source: string) {
    let result = transform.transform(createContext(source));

    return (result.imports || []).find(
        (imp) => imp.package === '@esportsplus/reactivity' && (imp.add || []).includes('signal')
    );
}


describe('compiler/selector', () => {
    describe('rewrite', () => {
        it('rewrites read(sel) === key inside a class binding to signal.selector', () => {
            let code = generatedCode(
                "let x = html`<div class=${() => read(sel) === row.id ? 'danger' : ''}></div>`;"
            );

            expect(code).toContain('signal.selector(sel, row.id)');
            expect(code).not.toContain('read(sel) === row.id');
        });

        it('emits a negated selector for !==', () => {
            let code = generatedCode(
                "let x = html`<div class=${() => read(sel) !== row.id ? 'danger' : ''}></div>`;"
            );

            expect(code).toContain('!signal.selector(sel, row.id)');
            expect(code).not.toContain('read(sel) !== row.id');
        });

        it('matches the lowered read(obj.key) form', () => {
            let code = generatedCode(
                "let x = html`<div class=${() => read(obj.key) === row.id ? 'x' : ''}></div>`;"
            );

            expect(code).toContain('signal.selector(obj.key, row.id)');
            expect(code).not.toContain('read(obj.key) === row.id');
        });

        it('leaves read(sel) === key untouched outside an observer arrow', () => {
            let code = generatedCode('let x = html`<div>${read(sel) === row.id}</div>`;');

            expect(code).not.toContain('signal.selector');
            expect(code).toContain('read(sel) === row.id');
        });
    });

    describe('import intent', () => {
        it('adds a signal import from @esportsplus/reactivity when a rewrite fired', () => {
            expect(
                signalIntent("let x = html`<div class=${() => read(sel) === row.id ? 'x' : ''}></div>`;")
            ).toBeDefined();
        });

        it('does not add a signal import when no rewrite fired', () => {
            expect(signalIntent('let x = html`<div>hello</div>`;')).toBeUndefined();
        });

        it('does not add a signal import when the source already imports signal', () => {
            expect(
                signalIntent(
                    "import { signal } from '@esportsplus/reactivity';\nlet x = html`<div class=${() => read(sel) === row.id ? 'x' : ''}></div>`;"
                )
            ).toBeUndefined();
        });
    });

    describe('read identity (checker-gated)', () => {
        it('does not match a shadowed local read under a checker', () => {
            let { checker, sourceFile } = createCheckerContext(
                    'function read(x) { return x; }\nlet x = read(sel) === row.id;'
                ),
                binary = findBinary(sourceFile);

            expect(binary).toBeDefined();
            expect(selectorComparison(binary!, checker)).toBeNull();
        });
    });
});
