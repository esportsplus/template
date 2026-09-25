import { ts } from '@esportsplus/typescript';
import { languageService, uid } from '@esportsplus/typescript/compiler';
import type { Plugin, SourceMapV3, TransformContext } from '@esportsplus/typescript/compiler';
import { cached } from './checker';
import { PACKAGE_NAME } from './constants';
import { edit } from './sourcemap';
import type { Edit } from './sourcemap';
import { isFunctionType } from './ts-analyzer';
import { findTemplateArtifacts } from './ts-parser';


// Per-plugin-instance handshake with the bundler integration: it sets `id` (null disables HMR,
// e.g. for SSR or builds) before each transform, and applies the resulting `plan` after it
// `templates` holds every module whose last dev transform found html sites
type HmrState = { id: string | null; plan: Site[] | null; templates: Set<string> };

// One entry per export site, in source order; `apply` re-finds the sites in the lowered code
type Site =
    | { kind: 'assignment'; wrapper: 'eager' | 'factory' }
    | { kind: 'function' }
    | { exports: { exportId: string; local: string; wrapper: 'callable' | 'factory' }[]; kind: 'list' };


const HMR_NAMESPACE = uid('hmr');

const HMR_PACKAGE = PACKAGE_NAME + '/hmr';

const HMR_TOKEN = '__hmr';

const REGEX_FUNCTION = /\b(async\s+)?function\b/;


// Decides which exports to wrap, on the original source with the project's checker. Returns null
// when any export or top-level statement makes the module unsafe to re-evaluate in place.
function analyze(ctx: TransformContext): Site[] | null {
    let checker = cached(ctx.checker),
        sites: Site[] = [],
        statements = ctx.sourceFile.statements;

    if (hasUnsafeSideEffects(ctx.sourceFile)) {
        return null;
    }

    for (let i = 0, n = statements.length; i < n; i++) {
        let statement = statements[i];

        switch (siteKind(statement)) {
            case 'assignment': {
                let expression = (statement as ts.ExportAssignment).expression,
                    type = checker.getTypeAtLocation(expression),
                    unwrapped = unwrap(expression);

                if (type !== undefined && isFunctionType(type, checker) && producesRenderable(type, checker, 2)) {
                    sites.push({ kind: 'assignment', wrapper: 'factory' });
                }
                else if (
                    type !== undefined &&
                    (ts.isCallExpression(unwrapped) || ts.isTaggedTemplateExpression(unwrapped)) &&
                    isRenderableType(type, checker)
                ) {
                    sites.push({ kind: 'assignment', wrapper: 'eager' });
                }
                else {
                    return null;
                }

                break;
            }

            case 'function': {
                let type = checker.getTypeAtLocation(statement);

                if (type === undefined || !producesRenderable(type, checker, 2)) {
                    return null;
                }

                sites.push({ kind: 'function' });
                break;
            }

            case 'list': {
                let elements = ((statement as ts.ExportDeclaration).exportClause as ts.NamedExports).elements,
                    exports: (Site & { kind: 'list' })['exports'] = [];

                for (let j = 0, m = elements.length; j < m; j++) {
                    let exportId = elements[j].name.text,
                        local = elements[j].propertyName ?? elements[j].name,
                        type = checker.getTypeAtLocation(local);

                    if (type === undefined || !isFunctionType(type, checker) || !producesRenderable(type, checker, 3)) {
                        return null;
                    }

                    exports.push({ exportId, local: local.text, wrapper: exportId === 'default' ? 'factory' : 'callable' });
                }

                sites.push({ exports, kind: 'list' });
                break;
            }

            default:
                if (
                    (ts.isVariableStatement(statement) || ts.isClassDeclaration(statement)) &&
                    hasModifier(statement, ts.SyntaxKind.ExportKeyword)
                ) {
                    return null;
                }
        }
    }

    return sites.length ? sites : null;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    let modifiers = (node as { modifiers?: readonly { kind: ts.SyntaxKind }[] }).modifiers;

    return modifiers !== undefined && modifiers.some((modifier) => modifier.kind === kind);
}

function hasUnsafeSideEffects(sourceFile: ts.SourceFile): boolean {
    for (let i = 0, n = sourceFile.statements.length; i < n; i++) {
        let statement = sourceFile.statements[i];

        if (ts.isExpressionStatement(statement)) {
            let expression = statement.expression;

            if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
                continue;
            }

            return true;
        }

        if (
            ts.isForStatement(statement) ||
            ts.isForInStatement(statement) ||
            ts.isForOfStatement(statement) ||
            ts.isWhileStatement(statement) ||
            ts.isDoStatement(statement) ||
            ts.isIfStatement(statement) ||
            ts.isSwitchStatement(statement) ||
            ts.isTryStatement(statement) ||
            ts.isThrowStatement(statement)
        ) {
            return true;
        }
    }

    return false;
}

function hotBlock(moduleId: string): string {
    return [
        `if (import.meta.hot) {`,
        `    import.meta.hot.dispose(() => { ${HMR_NAMESPACE}.dispose(${moduleId}); });`,
        `    import.meta.hot.prune(() => { ${HMR_NAMESPACE}.prune(${moduleId}); });`,
        `    import.meta.hot.accept((next) => {`,
        `        if (!next || !next.${HMR_TOKEN} || !${HMR_NAMESPACE}.accept(${moduleId})) {`,
        `            import.meta.hot.invalidate();`,
        `        }`,
        `    });`,
        `}`
    ].join('\n');
}

function isRenderableType(type: ts.Type, checker: ts.Checker): boolean {
    // Inspect the outer type, not its printed signature: Router<Renderable<T>>
    // and (element: Element) => number are not renderable values.
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) {
        return false;
    }

    if (type.getAliasSymbol()?.name === 'Renderable' || type.getSymbol()?.name === 'ArraySlot') {
        return true;
    }

    if (type.isUnionType()) {
        let types = type.getTypes().filter((member) => !(member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));

        return types.length > 0 && types.every((member) => isRenderableType(member, checker));
    }

    if (type.isTypeReference() && type.getSymbol()?.name === 'Array') {
        return checker.getTypeArguments(type).every((member) => isRenderableType(member, checker));
    }

    let node = checker.resolveName('Node', ts.SymbolFlags.Type),
        list = checker.resolveName('NodeList', ts.SymbolFlags.Type);

    return (node !== undefined && checker.isTypeAssignableTo(type, checker.getDeclaredTypeOfSymbol(node))) ||
        (list !== undefined && checker.isTypeAssignableTo(type, checker.getDeclaredTypeOfSymbol(list)));
}

function pickName(code: string, base: string, taken: Set<string>): string {
    let name = base,
        index = 1;

    while (code.includes(name) || taken.has(name)) {
        name = base + '_' + index;
        index++;
    }

    taken.add(name);

    return name;
}

// A component factory is a function whose (possibly nested) return value is a
// Renderable — e.g. `(attributes) => html`` ` or `factory('checkbox')`. Route
// registration factories like `(r) => r.get(...)` return a Router, not a
// Renderable, so they must NOT be wrapped as HMR components.
function producesRenderable(type: ts.Type, checker: ts.Checker, depth: number): boolean {
    if (isRenderableType(type, checker)) {
        return true;
    }

    if (depth <= 0 || !isFunctionType(type, checker)) {
        return false;
    }

    let signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);

    for (let i = 0, n = signatures.length; i < n; i++) {
        let returnType = checker.getReturnTypeOfSignature(signatures[i]);

        if (returnType !== undefined && producesRenderable(returnType, checker, depth - 1)) {
            return true;
        }
    }

    return false;
}

function siteKind(statement: ts.Statement): Site['kind'] | null {
    if (ts.isExportAssignment(statement)) {
        return statement.isExportEquals ? null : 'assignment';
    }

    if (
        ts.isFunctionDeclaration(statement) &&
        hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
        hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    ) {
        return 'function';
    }

    if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier === undefined &&
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause)
    ) {
        return 'list';
    }

    return null;
}

function unwrap(expression: ts.Expression): ts.Expression {
    while (
        ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isSatisfiesExpression(expression) ||
        ts.isNonNullExpression(expression)
    ) {
        expression = expression.expression;
    }

    return expression;
}


// Wraps each planned export site in the lowered code. Every edit stays on its line and every new
// line goes after the last one, so the pipeline's sourcemap only needs its columns shifted.
// Returns null (module keeps full-reload semantics) if the lowered code's sites no longer match.
const apply = (code: string, map: SourceMapV3, id: string, plan: Site[]): { code: string; map: SourceMapV3 } | null => {
    let edits: Edit[] = [],
        index = 0,
        moduleId = JSON.stringify(id),
        sourceFile = languageService.parse(id, code),
        tail: string[] = [],
        taken = new Set<string>();

    for (let i = 0, n = sourceFile.statements.length; i < n; i++) {
        let statement = sourceFile.statements[i],
            kind = siteKind(statement);

        if (kind === null) {
            continue;
        }

        let site = plan[index++];

        if (!site || site.kind !== kind) {
            return null;
        }

        if (site.kind === 'assignment') {
            let expression = (statement as ts.ExportAssignment).expression,
                start = expression.getStart(sourceFile);

            edits.push(
                { end: start, start, text: `${HMR_NAMESPACE}.${site.wrapper}(${moduleId}, "default", () => (` },
                { end: expression.end, start: expression.end, text: '))' }
            );
        }
        else if (site.kind === 'function') {
            let match = REGEX_FUNCTION.exec(statement.getText(sourceFile));

            if (match === null) {
                return null;
            }

            let start = statement.getStart(sourceFile) + match.index;

            edits.push(
                { end: start, start, text: `${HMR_NAMESPACE}.factory(${moduleId}, "default", () => (` },
                { end: statement.end, start: statement.end, text: '));' }
            );
        }
        else {
            let elements = ((statement as ts.ExportDeclaration).exportClause as ts.NamedExports).elements;

            if (elements.length !== site.exports.length) {
                return null;
            }

            for (let j = 0, m = elements.length; j < m; j++) {
                let element = elements[j],
                    entry = site.exports[j];

                if (element.name.text !== entry.exportId) {
                    return null;
                }

                let wrapper = pickName(code, '__hmr_' + entry.local, taken);

                if (element.propertyName) {
                    edits.push({ end: element.propertyName.end, start: element.propertyName.getStart(sourceFile), text: wrapper });
                }
                else {
                    let start = element.name.getStart(sourceFile);

                    edits.push({ end: start, start, text: wrapper + ' as ' });
                }

                tail.push(`const ${wrapper} = ${HMR_NAMESPACE}.${entry.wrapper}(${moduleId}, ${JSON.stringify(entry.exportId)}, () => ${entry.local});`);
            }
        }
    }

    if (index !== plan.length) {
        return null;
    }

    let token = pickName(code, HMR_TOKEN, taken),
        result = edit(code, map, edits);

    // Import declarations hoist and revision() is pure, so the header can trail the module
    tail.unshift(
        `import * as ${HMR_NAMESPACE} from '${HMR_PACKAGE}';`,
        `const ${token} = ${HMR_NAMESPACE}.revision(${moduleId});`,
        token === HMR_TOKEN ? `export { ${token} };` : `export { ${token} as ${HMR_TOKEN} };`
    );
    tail.push(hotBlock(moduleId));

    return { code: result.code + '\n' + tail.join('\n'), map: result.map };
};

// Runs first in the compiler pipeline and never edits code there: an edit would force the
// coordinator to re-sync the project program before the next plugin. It only records a plan, and
// only for modules that use html (under any name), which are the ones HMR wraps.
const plugin = (state: HmrState): Plugin => ({
    transform: (ctx) => {
        if (state.id === null) {
            state.plan = null;

            return {};
        }

        if (findTemplateArtifacts(ctx.sourceFile, ctx.checker, ctx.program).sites.size === 0) {
            state.templates.delete(state.id);
            state.plan = null;

            return {};
        }

        state.templates.add(state.id);
        state.plan = analyze(ctx);

        return {};
    }
});


export { apply, plugin };
export type { HmrState };
