import { ts } from '@esportsplus/typescript';
import { checker as checkers, imports } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT_REACTIVITY, PACKAGE_NAME, PACKAGE_REACTIVITY, PART, TYPES } from './constants';
import { constant, isConstDeclaration } from './specialize';
import { entrypointOf, isHtmlTemplate, unwrap } from './ts-parser';


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

// Callable members make a function only when every member is one; a member that is neither callable nor a string or
// number makes the value one to join without null, undefined and false
function judge(type: ts.Type | undefined, members: readonly ts.Type[], callable: Map<number, boolean>): PART {
    if (!type || type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
        return PART.Unknown;
    }

    let calls = 0,
        text = 0;

    for (let i = 0, n = members.length; i < n; i++) {
        let member = members[i];

        if (callable.get(member.id)) {
            calls++;
        }
        else if (member.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike)) {
            text++;
        }
    }

    if (calls === members.length) {
        return PART.Function;
    }

    if (calls > 0) {
        return PART.Unknown;
    }

    return text === members.length ? PART.Text : PART.Value;
}

function membersOf(type: ts.Type | undefined): readonly ts.Type[] {
    if (!type || type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
        return [];
    }

    return type.isUnionType() ? type.getTypes() : [type];
}

// `parts` holds what measure() already answered (see codegen's prefetch)
const analyze = (expr: ts.Expression, sites: Set<ts.Node>, checker?: ts.Checker, parts?: Map<ts.Expression, PART>): TYPES => {
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
        let whenFalse = analyze(expr.whenFalse, sites, checker, parts),
            whenTrue = analyze(expr.whenTrue, sites, checker, parts);

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
            if (partOf(expr, checker, parts) === PART.Function) {
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

// What each expression is (see PART), from its type: whether each union member is callable is asked in one request
const measure = (checker: ts.Checker, nodes: ts.Expression[], types: (ts.Type | undefined)[]): Map<ts.Expression, PART> => {
    let members: (readonly ts.Type[])[] = [],
        result = new Map<ts.Expression, PART>(),
        unique = new Map<number, ts.Type>();

    for (let i = 0, n = types.length; i < n; i++) {
        members[i] = membersOf(types[i]);

        for (let j = 0, m = members[i].length; j < m; j++) {
            let member = members[i][j];

            // No global interface stands behind these, so no declaration merging can make them callable
            if ((member.flags & (ts.TypeFlags.Never | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)) === 0) {
                unique.set(member.id, member);
            }
        }
    }

    let callable = new Map<number, boolean>(),
        candidates = [...unique.values()];

    if (candidates.length > 0) {
        let found = checkers.batch(checker, 'getSignaturesOfType', candidates.map(type => [type, ts.SignatureKind.Call] as [ts.Type, ts.SignatureKind]));

        for (let i = 0, n = candidates.length; i < n; i++) {
            callable.set(candidates[i].id, found[i].length > 0);
        }
    }

    for (let i = 0, n = nodes.length; i < n; i++) {
        result.set(nodes[i], judge(types[i], members[i], callable));
    }

    return result;
};

// What measure() answers for one expression, from `parts` when it is there
const partOf = (expr: ts.Expression, checker?: ts.Checker, parts?: Map<ts.Expression, PART>): PART => {
    let part = parts?.get(expr);

    if (part === undefined) {
        part = checker ? measure(checker, [expr], checker.getTypeAtLocation([expr])).get(expr)! : PART.Unknown;
        parts?.set(expr, part);
    }

    return part;
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


export { analyze, fold, isFunctionType, measure, partOf, selectorComparison };
export type { SelectorComparison };
