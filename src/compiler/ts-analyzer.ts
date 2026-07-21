import { ts } from '@esportsplus/typescript';
import { imports } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT, ENTRYPOINT_REACTIVITY, PACKAGE_NAME, TYPES } from './constants';


type SelectorComparison = {
    key: ts.Expression;
    negated: boolean;
    node: ts.Expression;
};


const PACKAGE_REACTIVITY = '@esportsplus/reactivity';

const READ = 'read';

// Conservative charset that is injection-safe in both text and quoted-attribute positions:
// no entity/tag delimiters and no quote characters, so a folded value can never break out
const REGEX_FOLD_SAFE = /^[^&<>"'`]*$/;


// A `read(sig)` call from @esportsplus/reactivity: exactly one argument, and — when a
// checker is available — an identity match against the reactivity import; without a checker
// (the checker-less transform harness) the guard degrades to a plain name match on `read`
function isReadCall(expr: ts.Expression, checker?: ts.TypeChecker): expr is ts.CallExpression {
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
function isTypeFunction(type: ts.Type, checker: ts.TypeChecker): boolean {
    if (type.isUnion()) {
        for (let i = 0, n = type.types.length; i < n; i++) {
            if (!isTypeFunction(type.types[i], checker)) {
                return false;
            }
        }

        return type.types.length > 0;
    }

    return type.getCallSignatures().length > 0;
}

function literal(type: ts.Type): string | null {
    if (type.isStringLiteral()) {
        return type.value;
    }

    if (type.isNumberLiteral()) {
        return String(type.value);
    }

    return null;
}


const analyze = (expr: ts.Expression, checker?: ts.TypeChecker): TYPES => {
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
            if (isTypeFunction(checker.getTypeAtLocation(expr), checker)) {
                return TYPES.Effect;
            }
        }
        catch (error) {
            console.warn(`${PACKAGE_NAME}: type analysis failed for '${expr.getText()}', classified as Unknown — ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return TYPES.Unknown;
};

const fold = (expr: ts.Expression, checker?: ts.TypeChecker): string | null => {
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
        value = literal(checker.getTypeAtLocation(expr));
    }

    return (value !== null && REGEX_FOLD_SAFE.test(value)) ? value : null;
};

const selectorComparison = (expr: ts.Expression, checker?: ts.TypeChecker): SelectorComparison | null => {
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
