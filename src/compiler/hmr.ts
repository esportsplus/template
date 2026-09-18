import { ts } from '@esportsplus/typescript';
import { languageService, uid } from '@esportsplus/typescript/compiler';
import { PACKAGE_NAME } from './constants';


type Edit = { end: number; start: number; text: string };


const HMR_NAMESPACE = uid('hmr');

const HMR_PACKAGE = PACKAGE_NAME + '/hmr';

const HMR_TOKEN = '__hmr';


function applyEdits(code: string, edits: Edit[]): string {
    edits.sort((a, b) => b.start - a.start || b.end - a.end);

    let output = code;

    for (let i = 0, n = edits.length; i < n; i++) {
        let edit = edits[i];

        output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    }

    return output;
}

function extractFunctionExpression(statement: ts.FunctionDeclaration): string {
    let text = statement.getText(),
        match = /\b(async\s+)?function\b/.exec(text);

    return match === null ? text : text.slice(match.index);
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    let modifiers = (node as any).modifiers as readonly { kind: ts.SyntaxKind }[] | undefined;

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
    let id = JSON.stringify(moduleId);

    return [
        `if (import.meta.hot) {`,
        `    import.meta.hot.dispose(() => { ${HMR_NAMESPACE}.dispose(${id}); });`,
        `    import.meta.hot.prune(() => { ${HMR_NAMESPACE}.prune(${id}); });`,
        `    import.meta.hot.accept((next) => {`,
        `        if (next && next.${HMR_TOKEN} && ${HMR_NAMESPACE}.accept(${id})) {`,
        `        }`,
        `        else {`,
        `            import.meta.hot.invalidate();`,
        `        }`,
        `    });`,
        `}`
    ].join('\n');
}

function importInsertPosition(sourceFile: ts.SourceFile): number {
    let position = 0;

    for (let i = 0, n = sourceFile.statements.length; i < n; i++) {
        let statement = sourceFile.statements[i];

        if (ts.isImportDeclaration(statement)) {
            position = statement.end;
        }
        else {
            break;
        }
    }

    return position;
}

function isFunctionType(type: ts.Type, checker: ts.Checker): boolean {
    if (type.isUnionType()) {
        let types = type.getTypes();

        if (types.length === 0) {
            return false;
        }

        for (let i = 0, n = types.length; i < n; i++) {
            if (!isFunctionType(types[i], checker)) {
                return false;
            }
        }

        return true;
    }

    return checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0;
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

function pickName(code: string, base: string): string {
    let name = base,
        index = 1;

    while (code.includes(name)) {
        name = base + '_' + index;
        index++;
    }

    return name;
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


const transform = (code: string, moduleId: string): { code: string; selfAccept: boolean } => {
    let { checker, sourceFile } = languageService.scratch(moduleId, code),
        edits: Edit[] = [],
        supported = !hasUnsafeSideEffects(sourceFile);

    if (supported) {
        for (let i = 0, n = sourceFile.statements.length; i < n; i++) {
            let statement = sourceFile.statements[i];

            if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
                let expression = statement.expression,
                    type = checker.getTypeAtLocation(expression);

                if (type !== undefined && isFunctionType(type, checker) && producesRenderable(type, checker, 2)) {
                    edits.push({
                        end: expression.end,
                        start: expression.getStart(sourceFile),
                        text: `${HMR_NAMESPACE}.factory(${JSON.stringify(moduleId)}, "default", () => (${expression.getText(sourceFile)}))`
                    });
                }
                else if (type !== undefined && ts.isCallExpression(unwrap(expression)) && isRenderableType(type, checker)) {
                    edits.push({
                        end: expression.end,
                        start: expression.getStart(sourceFile),
                        text: `${HMR_NAMESPACE}.eager(${JSON.stringify(moduleId)}, "default", () => (${expression.getText(sourceFile)}))`
                    });
                }
                else {
                    supported = false;
                }
            }
            else if (
                ts.isFunctionDeclaration(statement) &&
                hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
                hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
            ) {
                let type = checker.getTypeAtLocation(statement);

                if (type !== undefined && producesRenderable(type, checker, 2)) {
                    edits.push({
                        end: statement.end,
                        start: statement.getStart(sourceFile),
                        text: `export default ${HMR_NAMESPACE}.factory(${JSON.stringify(moduleId)}, "default", () => (${extractFunctionExpression(statement)}));`
                    });
                }
                else {
                    supported = false;
                }
            }
            else if (
                ts.isExportDeclaration(statement) &&
                statement.moduleSpecifier === undefined &&
                statement.exportClause !== undefined &&
                ts.isNamedExports(statement.exportClause)
            ) {
                let elements = statement.exportClause.elements,
                    lines: string[] = [],
                    specifiers: string[] = [];

                for (let j = 0, m = elements.length; j < m; j++) {
                    let element = elements[j],
                        local = element.propertyName ?? element.name,
                        exportId = element.name.text;

                    let type = checker.getTypeAtLocation(local);

                    if (type === undefined || !isFunctionType(type, checker) || !producesRenderable(type, checker, 3)) {
                        supported = false;
                        break;
                    }

                    let wrapper = pickName(code, '__hmr_' + local.text),
                        kind = exportId === 'default' ? 'factory' : 'callable';

                    lines.push(`const ${wrapper} = ${HMR_NAMESPACE}.${kind}(${JSON.stringify(moduleId)}, ${JSON.stringify(exportId)}, () => ${local.text});`);
                    specifiers.push(`${wrapper} as ${exportId}`);
                }

                if (supported) {
                    lines.push(`export { ${specifiers.join(', ')} };`);
                    edits.push({
                        end: statement.end,
                        start: statement.getStart(sourceFile),
                        text: lines.join('\n')
                    });
                }
            }
            else if (
                (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) ||
                (ts.isClassDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword))
            ) {
                supported = false;
            }
        }
    }

    if (!supported || edits.length === 0) {
        return { code, selfAccept: false };
    }

    let position = importInsertPosition(sourceFile),
        token = pickName(code, HMR_TOKEN),
        tokenExport = token === HMR_TOKEN ? `export { ${token} };` : `export { ${token} as ${HMR_TOKEN} };`,
        header = [
            `import * as ${HMR_NAMESPACE} from '${HMR_PACKAGE}';`,
            `const ${token} = ${HMR_NAMESPACE}.revision(${JSON.stringify(moduleId)});`,
            tokenExport,
            ''
        ].join('\n');

    edits.push({
        end: position,
        start: position,
        text: position > 0 ? '\n' + header : header
    });

    edits.push({
        end: code.length,
        start: code.length,
        text: `\n${hotBlock(moduleId)}`
    });

    return { code: applyEdits(code, edits), selfAccept: true };
};


export { transform };
