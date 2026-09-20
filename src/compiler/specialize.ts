import { ts } from '@esportsplus/typescript';


type Primitive = string | number | boolean;
type Variant = { condition: string; values: Map<ts.Expression, string> };
const UNKNOWN = Symbol();
const LIMIT = 16;
const SAFE = /^[^&<>"'`]*$/;

// Partial evaluation is deliberately restricted to primitive syntax. Never call
// user code, read an object property/getter, or evaluate a reactive callback.
function evaluate(node: ts.Expression, checker: ts.Checker, environment: Map<ts.Symbol, Primitive>, visiting = new Set<ts.Symbol>()): Primitive | typeof UNKNOWN {
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return evaluate(node.expression, checker, environment, visiting);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isIdentifier(node)) {
        let symbol = checker.getSymbolAtLocation(node);
        if (!symbol) return UNKNOWN;
        if (environment.has(symbol)) return environment.get(symbol)!;
        if (visiting.has(symbol)) return UNKNOWN;
        let declaration = symbol.valueDeclaration?.resolve();
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer &&
            ts.isVariableDeclarationList(declaration.parent) && (declaration.parent.flags & ts.NodeFlags.Const)) {
            visiting.add(symbol);
            let value = evaluate(declaration.initializer, checker, environment, visiting);
            visiting.delete(symbol);
            return value;
        }
    }
    if (ts.isConditionalExpression(node)) {
        let condition = evaluate(node.condition, checker, environment, visiting);
        return condition === UNKNOWN ? UNKNOWN : evaluate(condition ? node.whenTrue : node.whenFalse, checker, environment, visiting);
    }
    if (ts.isBinaryExpression(node)) {
        let left = evaluate(node.left, checker, environment, visiting);
        if (left === UNKNOWN) return UNKNOWN;
        let right = evaluate(node.right, checker, environment, visiting);
        if (right === UNKNOWN) return UNKNOWN;
        switch (node.operatorToken.kind) {
            case ts.SyntaxKind.EqualsEqualsEqualsToken: return left === right;
            case ts.SyntaxKind.ExclamationEqualsEqualsToken: return left !== right;
            case ts.SyntaxKind.PlusToken:
                if (typeof left === 'string' || typeof right === 'string') return String(left) + String(right);
                if (typeof left === 'number' && typeof right === 'number') return left + right;
        }
    }
    return UNKNOWN;
}

function immutable(parameter: ts.ParameterDeclaration, symbol: ts.Symbol, checker: ts.Checker): boolean {
    let safe = true;
    const contains = (node: ts.Node): boolean => {
        if (ts.isShorthandPropertyAssignment(node) && checker.getShorthandAssignmentValueSymbol(node) === symbol) return true;
        if (ts.isIdentifier(node) && checker.getSymbolAtLocation(node) === symbol) return true;
        return node.forEachChild(contains) === true;
    };
    const visit = (node: ts.Node) => {
        // Aliased arguments and eval can write a binding without an AST assignment.
        if (ts.isIdentifier(node) && (node.text === 'arguments' || node.text === 'eval')) safe = false;
        if (ts.isBinaryExpression(node) &&
            node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
            contains(node.left)) safe = false;
        if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
            (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) && contains(node.operand)) safe = false;
        if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && contains(node.initializer)) safe = false;
        if (safe) node.forEachChild(visit);
    };
    visit(parameter.parent);
    return safe;
}

// Enumerating a bounded, immutable parameter gives static clones without copying
// factory bodies across modules or relying on bundler inlining. Unknown runtime
// values still take the original generic binding path.
function specialize(expressions: ts.Expression[], checker?: ts.Checker): Variant[] {
    if (!checker) return [];
    let parameters = new Map<ts.Symbol, { name: string; values: Primitive[] }>();

    const visit = (node: ts.Node) => {
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isTaggedTemplateExpression(node)) return;
        if (ts.isIdentifier(node)) {
            let symbol = checker.getSymbolAtLocation(node),
                declaration = symbol?.valueDeclaration?.resolve();
            if (symbol && declaration?.kind === ts.SyntaxKind.Parameter && ts.isIdentifier((declaration as ts.ParameterDeclaration).name) && !parameters.has(symbol)) {
                let parameter = declaration as ts.ParameterDeclaration;
                let type = checker.getTypeAtLocation(parameter.name),
                    types = type?.isUnionType() ? type.getTypes() : type ? [type] : [],
                    values: Primitive[] = [];
                for (let type of types) {
                    if (type.isStringLiteralType() || type.isNumberLiteralType()) values.push(type.value);
                    else return;
                }
                if (values.length && values.length <= LIMIT && immutable(parameter, symbol, checker)) {
                    parameters.set(symbol, { name: node.text, values });
                }
            }
        }
        node.forEachChild(visit);
    };
    expressions.forEach(visit);
    if (!parameters.size) return [];

    let combinations: { environment: Map<ts.Symbol, Primitive>; conditions: string[] }[] = [{ environment: new Map(), conditions: [] }];
    for (let [symbol, parameter] of parameters) {
        if (combinations.length * parameter.values.length > LIMIT) return [];
        combinations = combinations.flatMap(combination => parameter.values.map(value => ({
            environment: new Map([...combination.environment, [symbol, value]]),
            conditions: [...combination.conditions, `${parameter.name} === ${JSON.stringify(value)}`]
        })));
    }

    return combinations.map(({ environment, conditions }) => {
        let values = new Map<ts.Expression, string>();
        for (let expression of expressions) {
            let value = evaluate(expression, checker, environment);
            if ((typeof value === 'string' || typeof value === 'number') && SAFE.test(String(value))) values.set(expression, String(value));
        }
        return { condition: conditions.join(' && '), values };
    }).filter(variant => variant.values.size > 0);
}

const constant = (node: ts.Expression, checker: ts.Checker): string | null => {
    let value = evaluate(node, checker, new Map());
    return value !== UNKNOWN && SAFE.test(String(value)) ? String(value) : null;
};

export { constant, specialize };
