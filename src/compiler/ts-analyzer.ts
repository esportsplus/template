import { ts } from '@esportsplus/typescript';
import { imports } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT_REACTIVITY, PACKAGE_NAME, PACKAGE_REACTIVITY, TYPES } from './constants';
import { constant, isConstDeclaration } from './specialize';
import { entrypointOf, isHtmlTemplate } from './ts-parser';


type SelectorComparison = {
    key: ts.Expression;
    negated: boolean;
    node: ts.Expression;
};


const READ = 'read';


// A readonly literal property (`CONFIG.size`) folds only when its owner is a local const
// bound directly to an object literal: never an object-producing call or getter chain
function foldProperty(expr: ts.PropertyAccessExpression, checker: ts.Checker, names?: Set<string>): string | null {
    if (!ts.isIdentifier(expr.expression) || (names && !names.has(expr.expression.text))) {
        return null;
    }

    let declaration = checker.getSymbolAtLocation(expr.name)?.valueDeclaration?.resolve();

    if (!declaration || !ts.isPropertyAssignment(declaration)) {
        return null;
    }

    let owner = checker.getSymbolAtLocation(expr.expression)?.valueDeclaration?.resolve();

    if (!owner || !isConstDeclaration(owner) || !ts.isObjectLiteralExpression(unwrap(owner.initializer))) {
        return null;
    }

    let type = checker.getTypeAtLocation(expr);

    if (!type || (!type.isStringLiteralType() && !type.isNumberLiteralType())) {
        return null;
    }

    return constant(declaration.initializer, checker, names);
}

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

function unwrap(expr: ts.Expression): ts.Expression {
    while (ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr) || ts.isSatisfiesExpression(expr)) {
        expr = expr.expression;
    }

    return expr;
}


const analyze = (expr: ts.Expression, sites: Set<ts.Node>, checker?: ts.Checker): TYPES => {
    while (ts.isParenthesizedExpression(expr)) {
        expr = expr.expression;
    }

    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        return TYPES.Effect;
    }

    // html.reactive() and html.virtual() calls are inlined by the compiler into slot constructions
    let entrypoint = entrypointOf(expr, sites);

    if (entrypoint) {
        return entrypoint === ENTRYPOINT_REACTIVITY ? TYPES.ArraySlot : TYPES.VirtualSlot;
    }

    if (isHtmlTemplate(expr, sites)) {
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
        let whenFalse = analyze(expr.whenFalse, sites, checker),
            whenTrue = analyze(expr.whenTrue, sites, checker);

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

            if (type && isFunctionType(type, checker)) {
                return TYPES.Effect;
            }
        }
        catch (error) {
            console.warn(`${PACKAGE_NAME}: type analysis failed for '${expr.getText()}', classified as Unknown — ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return TYPES.Unknown;
};

// `names` narrows which identifiers are worth resolving (see Artifacts.constants)
const fold = (expr: ts.Expression, checker?: ts.Checker, names?: Set<string>): string | null => {
    expr = unwrap(expr);

    if (ts.isPropertyAccessExpression(expr)) {
        return checker ? foldProperty(expr, checker, names) : null;
    }

    return constant(expr, checker, names);
};

// Union types that mix functions with non-functions (e.g., Renderable) are not functions,
// so they fall through to runtime slot dispatch
const isFunctionType = (type: ts.Type, checker: ts.Checker): boolean => {
    if (type.isUnionType()) {
        let types = type.getTypes();

        for (let i = 0, n = types.length; i < n; i++) {
            if (!isFunctionType(types[i], checker)) {
                return false;
            }
        }

        return types.length > 0;
    }

    return checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0;
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


export { analyze, fold, isFunctionType, selectorComparison };
export type { SelectorComparison };
