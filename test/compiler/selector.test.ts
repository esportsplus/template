import { describe, expect, it } from 'vitest';
import { ts } from '@esportsplus/typescript';
import { languageService } from '@esportsplus/typescript/compiler';
import type { TransformContext } from '@esportsplus/typescript/compiler';
import { readCalls, selectorComparison } from '../../src/compiler/ts-analyzer';

import transform from '../../src/compiler';
import { written } from './written';


const EMPTY = await languageService.parse(process.cwd() + '/empty.ts', '');


async function createCheckerContext(source: string) {
    let { checker, sourceFile } = await languageService.scratch(process.cwd() + '/selector-test.ts', source);

    return { checker, sourceFile };
}

// Syntax only: no checker or program, which the compiler's analysis takes as optional
async function createContext(source: string) {
    let sourceFile = await languageService.parse(process.cwd() + '/test.ts', source);

    return { code: source, shared: new Map(), sourceFile } as TransformContext;
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

    node.forEachChild((child) => {
        if (!found) {
            found = findBinary(child);
        }
    });

    return found;
}

async function generatedCode(source: string): Promise<string> {
    let result = await transform.transform(await createContext(source));

    return (result.replacements || []).map((r) => r.generate(EMPTY, written)).join('\n');
}

async function signalIntent(source: string) {
    let result = await transform.transform(await createContext(source));

    return (result.imports || []).find(
        (imp) => imp.package === '@esportsplus/reactivity' && (imp.add || []).includes('signal')
    );
}


describe('compiler/selector', () => {
    describe('rewrite', () => {
        it('rewrites read(sel) === key inside a class binding to signal.selector', async () => {
            let code = await generatedCode(
                "let x = html`<div class=${() => read(sel) === row.id ? 'danger' : ''}></div>`;"
            );

            expect(code).toContain('signal.selector(sel, row.id)');
            expect(code).not.toContain('read(sel) === row.id');
        });

        it('emits a negated selector for !==', async () => {
            let code = await generatedCode(
                "let x = html`<div class=${() => read(sel) !== row.id ? 'danger' : ''}></div>`;"
            );

            expect(code).toContain('!signal.selector(sel, row.id)');
            expect(code).not.toContain('read(sel) !== row.id');
        });

        it('matches the lowered read(obj.key) form', async () => {
            let code = await generatedCode(
                "let x = html`<div class=${() => read(obj.key) === row.id ? 'x' : ''}></div>`;"
            );

            expect(code).toContain('signal.selector(obj.key, row.id)');
            expect(code).not.toContain('read(obj.key) === row.id');
        });

        it('leaves read(sel) === key untouched outside an observer arrow', async () => {
            let code = await generatedCode('let x = html`<div>${read(sel) === row.id}</div>`;');

            expect(code).not.toContain('signal.selector');
            expect(code).toContain('read(sel) === row.id');
        });
    });

    describe('import intent', () => {
        it('adds a signal import from @esportsplus/reactivity when a rewrite fired', async () => {
            expect(
                await signalIntent("let x = html`<div class=${() => read(sel) === row.id ? 'x' : ''}></div>`;")
            ).toBeDefined();
        });

        it('does not add a signal import when no rewrite fired', async () => {
            expect(await signalIntent('let x = html`<div>hello</div>`;')).toBeUndefined();
        });

        it('does not add a signal import when the source already imports signal', async () => {
            expect(
                await signalIntent(
                    "import { signal } from '@esportsplus/reactivity';\nlet x = html`<div class=${() => read(sel) === row.id ? 'x' : ''}></div>`;"
                )
            ).toBeUndefined();
        });
    });

    describe('read identity (checker-gated)', () => {
        it('does not match a shadowed local read under a checker', async () => {
            let { checker, sourceFile } = await createCheckerContext(
                    'function read(x) { return x; }\nlet x = read(sel) === row.id;'
                ),
                binary = findBinary(sourceFile);

            expect(binary).toBeDefined();
            expect(selectorComparison(binary!, await readCalls(checker, sourceFile))).toBeNull();
        });
    });
});
