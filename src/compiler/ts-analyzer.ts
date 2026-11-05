import { ts } from '@esportsplus/typescript';
import { imports } from '@esportsplus/typescript/compiler';
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
async function foldProperty(expr: ts.PropertyAccessExpression, checker: ts.Checker, names?: Set<string>): Promise<string | null> {
    if (!ts.isIdentifier(expr.expression) || (names && !names.has(expr.expression.text))) {
        return null;
    }

    let [property, receiver] = await checker.getSymbolAtLocation([expr.name, expr.expression]),
        [declaration, owner] = await Promise.all([property?.valueDeclaration?.resolve(), receiver?.valueDeclaration?.resolve()]);

    if (!declaration || !ts.isPropertyAssignment(declaration)) {
        return null;
    }

    if (!owner || !isConstDeclaration(owner) || !ts.isObjectLiteralExpression(unwrap(owner.initializer))) {
        return null;
    }

    let type = await checker.getTypeAtLocation(expr);

    if (!type || (!type.isStringLiteralType() && !type.isNumberLiteralType())) {
        return null;
    }

    return constant(declaration.initializer, checker, names);
}

// A `read(sig)` call: exactly one argument; `reads`, when given, holds the calls proven to be
// @esportsplus/reactivity's (see readCalls()), and without it (the checker-less transform harness)
// the guard degrades to a plain name match on `read`
function isReadCall(expr: ts.Expression, reads?: Set<ts.Node>): expr is ts.CallExpression {
    return isReadSyntax(expr) && (!reads || reads.has(expr));
}

function isReadSyntax(expr: ts.Node): expr is ts.CallExpression & { expression: ts.Identifier } {
    return ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === READ && expr.arguments.length === 1;
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

async function membersOf(type: ts.Type | undefined): Promise<readonly ts.Type[]> {
    if (!type || type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
        return [];
    }

    return type.isUnionType() ? await type.getTypes() : [type];
}


// `parts` holds what measure() answered for the file (see codegen's prefetch()); an expression it
// does not hold is left to the runtime
const analyze = (expr: ts.Expression, sites: Set<ts.Node>, parts?: Map<ts.Expression, PART>): TYPES => {
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
        let whenFalse = analyze(expr.whenFalse, sites, parts),
            whenTrue = analyze(expr.whenTrue, sites, parts);

        if (whenTrue === whenFalse) {
            return whenTrue;
        }

        if (whenTrue === TYPES.Effect || whenFalse === TYPES.Effect) {
            return TYPES.Effect;
        }

        return TYPES.Unknown;
    }

    if ((ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr) || ts.isCallExpression(expr)) && partOf(expr, parts) === PART.Function) {
        return TYPES.Effect;
    }

    return TYPES.Unknown;
};

// `names` narrows which identifiers are worth resolving (see Artifacts.constants)
const fold = async (expr: ts.Expression, checker?: ts.Checker, names?: Set<string>): Promise<string | null> => {
    expr = unwrap(expr);

    if (ts.isPropertyAccessExpression(expr)) {
        return checker ? foldProperty(expr, checker, names) : null;
    }

    return constant(expr, checker, names);
};

// Union types that mix functions with non-functions (e.g., Renderable) are not functions,
// so they fall through to runtime slot dispatch
const isFunctionType = async (type: ts.Type, checker: ts.Checker): Promise<boolean> => {
    if (type.isUnionType()) {
        let types = await type.getTypes(),
            functions = await Promise.all(types.map((member) => isFunctionType(member, checker)));

        return types.length > 0 && functions.every(Boolean);
    }

    return (await checker.getSignaturesOfType(type, ts.SignatureKind.Call)).length > 0;
};

// What each expression is (see PART), from its type: the types, then every union's members, then whether each member is
// callable, each step one request. A checker that fails classifies every expression as Unknown, never the build.
const measure = async (checker: ts.Checker, nodes: ts.Expression[]): Promise<Map<ts.Expression, PART>> => {
    let result = new Map<ts.Expression, PART>();

    if (nodes.length === 0) {
        return result;
    }

    try {
        let types = await checker.getTypeAtLocation(nodes) as (ts.Type | undefined)[],
            members = await Promise.all(types.map(membersOf)),
            unique = new Map<number, ts.Type>();

        for (let i = 0, n = members.length; i < n; i++) {
            for (let j = 0, m = members[i].length; j < m; j++) {
                let member = members[i][j];

                // No global interface stands behind these, so no declaration merging can make them callable
                if ((member.flags & (ts.TypeFlags.Never | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)) === 0) {
                    unique.set(member.id, member);
                }
            }
        }

        let callable = new Map<number, boolean>(),
            candidates = [...unique.values()],
            signatures = await Promise.all(candidates.map(type => checker.getSignaturesOfType(type, ts.SignatureKind.Call)));

        for (let i = 0, n = candidates.length; i < n; i++) {
            callable.set(candidates[i].id, signatures[i].length > 0);
        }

        for (let i = 0, n = nodes.length; i < n; i++) {
            result.set(nodes[i], judge(types[i], members[i], callable));
        }
    }
    catch (error) {
        console.warn(
            `${PACKAGE_NAME}: type analysis failed for ${nodes.map(node => `'${node.getText()}'`).join(', ')}, classified as Unknown — ` +
            (error instanceof Error ? error.message : String(error))
        );
        result.clear();
    }

    return result;
};

// What measure() answered for one expression; Unknown when it was not asked
const partOf = (expr: ts.Expression, parts?: Map<ts.Expression, PART>): PART => {
    return parts?.get(expr) ?? PART.Unknown;
};

// The `read(x)` calls compared with `===`/`!==` anywhere in the file that are @esportsplus/reactivity's, resolved
// together for selectorComparison()
const readCalls = async (checker: ts.Checker, sourceFile: ts.SourceFile): Promise<Set<ts.Node>> => {
    let candidates: (ts.CallExpression & { expression: ts.Identifier })[] = [];

    let visit = (node: ts.Node): void => {
        if (
            ts.isBinaryExpression(node) &&
            (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
        ) {
            if (isReadSyntax(node.left)) {
                candidates.push(node.left);
            }

            if (isReadSyntax(node.right)) {
                candidates.push(node.right);
            }
        }

        node.forEachChild(visit);
    };

    visit(sourceFile);

    let reads = new Set<ts.Node>(),
        included = await Promise.all(candidates.map(call => imports.includes(checker, call.expression, PACKAGE_REACTIVITY, READ)));

    for (let i = 0, n = candidates.length; i < n; i++) {
        if (included[i]) {
            reads.add(candidates[i]);
        }
    }

    return reads;
};

const selectorComparison = (expr: ts.Expression, reads?: Set<ts.Node>): SelectorComparison | null => {
    if (
        !ts.isBinaryExpression(expr) ||
        (expr.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
            expr.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken)
    ) {
        return null;
    }

    let negated = expr.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;

    if (isReadCall(expr.left, reads)) {
        return { key: expr.right, negated, node: expr.left.arguments[0] };
    }

    if (isReadCall(expr.right, reads)) {
        return { key: expr.left, negated, node: expr.right.arguments[0] };
    }

    return null;
};


export { analyze, fold, isFunctionType, measure, partOf, readCalls, selectorComparison };
export type { SelectorComparison };
