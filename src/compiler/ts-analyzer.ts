import { ts } from '@esportsplus/typescript';
import { imports } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT, ENTRYPOINT_REACTIVITY, PACKAGE_NAME, PACKAGE_REACTIVITY, TYPES } from './constants';
import { constant } from './specialize';


type SelectorComparison = {
    key: ts.Expression;
    negated: boolean;
    node: ts.Expression;
};

const READ = 'read';

// Conservative charset that is injection-safe in both text and quoted-attribute positions:
// no entity/tag delimiters and no quote characters, so a folded value can never break out
const REGEX_FOLD_SAFE = /^[^&<>"'`]*$/;


// A `read(sig)` call from @esportsplus/reactivity: exactly one argument, and — when a
// checker is available — an identity match against the reactivity import; without a checker
// (the checker-less transform harness) the guard degrades to a plain name match on `read`
function isReadCall(expr: ts.Expression, checker?: ts.Checker): expr is ts.CallExpression {
    return (
        ts.isCallExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === READ &&
        expr.arguments.length === 1 &&
        (!checker || imports.includes(checker, expr.expression, PACKAGE_REACTIVITY, READ))
    );
}

// Union types that mix functions with non-functions (e.g., Renderable)
// should fall through to runtime slot dispatch
function isTypeFunction(type: ts.Type, checker: ts.Checker): boolean {
    if (type.isUnionType()) {
        let types = type.getTypes();

        for (let i = 0, n = types.length; i < n; i++) {
            if (!isTypeFunction(types[i], checker)) {
                return false;
            }
        }

        return types.length > 0;
    }

    return checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0;
}

function literal(type: ts.Type): string | null {
    if (type.isStringLiteralType()) {
        return type.value;
    }

    if (type.isNumberLiteralType()) {
        return String(type.value);
    }

    return null;
}


const analyze = (expr: ts.Expression, checker?: ts.Checker): TYPES => {
    while (ts.isParenthesizedExpression(expr)) {
        expr = expr.expression;
    }

    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        return TYPES.Effect;
    }

    // Only html.reactive() calls become ArraySlot - handled by generateReactiveInlining
    if (
        ts.isCallExpression(expr) &&
        ts.isPropertyAccessExpression(expr.expression) &&
        ts.isIdentifier(expr.expression.expression) &&
        expr.expression.expression.text === ENTRYPOINT &&
        expr.expression.name.text === ENTRYPOINT_REACTIVITY
    ) {
        return TYPES.ArraySlot;
    }

    if (ts.isTaggedTemplateExpression(expr) && ts.isIdentifier(expr.tag) && expr.tag.text === ENTRYPOINT) {
        return TYPES.DocumentFragment;
    }

    if (
        ts.isNumericLiteral(expr) ||
        ts.isStringLiteral(expr) ||
        ts.isNoSubstitutionTemplateLiteral(expr) ||
        expr.kind === ts.SyntaxKind.TrueKeyword ||
        expr.kind === ts.SyntaxKind.FalseKeyword ||
        expr.kind === ts.SyntaxKind.NullKeyword ||
        expr.kind === ts.SyntaxKind.UndefinedKeyword
    ) {
        return TYPES.Static;
    }

    if (ts.isTemplateExpression(expr)) {
        return TYPES.Primitive;
    }

    if (ts.isConditionalExpression(expr)) {
        let whenFalse = analyze(expr.whenFalse, checker),
            whenTrue = analyze(expr.whenTrue, checker);

        if (whenTrue === whenFalse) {
            return whenTrue;
        }

        if (whenTrue === TYPES.Effect || whenFalse === TYPES.Effect) {
            return TYPES.Effect;
        }

        return TYPES.Unknown;
    }

    if (checker && (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr) || ts.isCallExpression(expr))) {
        try {
            let type = checker.getTypeAtLocation(expr);

            if (type && isTypeFunction(type, checker)) {
                return TYPES.Effect;
            }
        }
        catch (error) {
            console.warn(`${PACKAGE_NAME}: type analysis failed for '${expr.getText()}', classified as Unknown — ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return TYPES.Unknown;
};

const fold = (expr: ts.Expression, checker?: ts.Checker): string | null => {
    while (ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr) || ts.isSatisfiesExpression(expr)) {
        expr = expr.expression;
    }

    let value: string | null = null;

    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr) || ts.isNumericLiteral(expr)) {
        value = expr.text;
    }
    else if (expr.kind === ts.SyntaxKind.TrueKeyword) {
        value = 'true';
    }
    else if (expr.kind === ts.SyntaxKind.FalseKeyword) {
        value = 'false';
    }
    else if (checker && (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr))) {
        let declaration = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expr) ? expr.name : expr)?.valueDeclaration?.resolve();

        // A literal return type is not evidence that reading a getter is pure.
        // Factory parameters are folded only under a guarded specialization.
        if (!declaration || (ts.isIdentifier(expr)
            ? !ts.isVariableDeclaration(declaration) || !declaration.initializer ||
                !ts.isVariableDeclarationList(declaration.parent) || !(declaration.parent.flags & ts.NodeFlags.Const)
            : !ts.isPropertyAssignment(declaration))) {
            return null;
        }

        if (ts.isIdentifier(expr)) {
            value = constant(expr, checker);
        }
        else {
            // Preserve folding for a directly declared readonly literal object,
            // but never eliminate an object-producing call or getter chain.
            if (!ts.isIdentifier(expr.expression)) return null;
            let owner = checker.getSymbolAtLocation(expr.expression)?.valueDeclaration?.resolve();
            if (!owner || !ts.isVariableDeclaration(owner) || !owner.initializer ||
                !ts.isVariableDeclarationList(owner.parent) || !(owner.parent.flags & ts.NodeFlags.Const)) return null;
            let initializer = owner.initializer;
            while (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer) || ts.isSatisfiesExpression(initializer)) initializer = initializer.expression;
            if (!ts.isObjectLiteralExpression(initializer)) return null;
            let type = checker.getTypeAtLocation(expr);
            value = type && literal(type) !== null ? constant((declaration as ts.PropertyAssignment).initializer, checker) : null;
        }
    }
    else if (checker && (ts.isConditionalExpression(expr) || ts.isBinaryExpression(expr))) {
        value = constant(expr, checker);
    }

    return (value !== null && REGEX_FOLD_SAFE.test(value)) ? value : null;
};

const selectorComparison = (expr: ts.Expression, checker?: ts.Checker): SelectorComparison | null => {
    if (
        !ts.isBinaryExpression(expr) ||
        (expr.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
            expr.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken)
    ) {
        return null;
    }

    let negated = expr.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;

    if (isReadCall(expr.left, checker)) {
        return { key: expr.right, negated, node: expr.left.arguments[0] };
    }

    if (isReadCall(expr.right, checker)) {
        return { key: expr.left, negated, node: expr.right.arguments[0] };
    }

    return null;
};

export { analyze, fold, selectorComparison };
export type { SelectorComparison };
