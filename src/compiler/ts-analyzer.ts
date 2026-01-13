import { ts } from '@esportsplus/typescript';
import { ENTRYPOINT, ENTRYPOINT_REACTIVITY, TYPES } from './constants';


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
        catch {}
    }

    return TYPES.Unknown;
};

export { analyze };
