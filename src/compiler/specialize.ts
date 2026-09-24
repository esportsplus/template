import { ts } from '@esportsplus/typescript';


type Primitive = boolean | number | string;

type Scope = {
    checker?: ts.Checker;
    // Identifier texts that can resolve to a value; any other identifier is unknown without
    // paying a checker round-trip. Undefined queries every identifier.
    names?: Set<string>;
    values: Map<ts.Symbol, Primitive>;
    visiting: Set<ts.Symbol>;
};

type Variant = { condition: string; values: Map<ts.Expression, string> };


const LIMIT = 16;

// Conservative charset that is injection-safe in both text and quoted-attribute positions:
// no entity/tag delimiters and no quote characters, so a folded value can never break out
const REGEX_SAFE = /^[^&<>"'`]*$/;

const UNKNOWN = Symbol();


function combine(parameters: Map<ts.Symbol, { name: string; values: Primitive[] }>) {
    let combinations: { conditions: string[]; environment: Map<ts.Symbol, Primitive> }[] = [{ conditions: [], environment: new Map() }];

    for (let [symbol, parameter] of parameters) {
        if (combinations.length * parameter.values.length > LIMIT) {
            return null;
        }

        let next: typeof combinations = [];

        for (let i = 0, n = combinations.length; i < n; i++) {
            let { conditions, environment } = combinations[i];

            for (let j = 0, m = parameter.values.length; j < m; j++) {
                let value = parameter.values[j];

                next.push({
                    // Dispatch must not narrow the original parameter inside emitted
                    // branches: its unchanged body may still compare other union members.
                    conditions: [...conditions, `(${parameter.name} as unknown) === ${JSON.stringify(value)}`],
                    environment: new Map(environment).set(symbol, value)
                });
            }
        }

        combinations = next;
    }

    return combinations;
}

// Partial evaluation is deliberately restricted to primitive syntax. Never call
// user code, read an object property/getter, or evaluate a reactive callback.
// Without a checker only literal syntax evaluates; identifiers stay unknown.
function evaluate(node: ts.Expression, scope: Scope): Primitive | typeof UNKNOWN {
    while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) {
        node = node.expression;
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
    }

    if (ts.isNumericLiteral(node)) {
        return Number(node.text);
    }

    if (node.kind === ts.SyntaxKind.TrueKeyword) {
        return true;
    }

    if (node.kind === ts.SyntaxKind.FalseKeyword) {
        return false;
    }

    if (ts.isIdentifier(node)) {
        return identifier(node, scope);
    }

    if (ts.isConditionalExpression(node)) {
        let condition = evaluate(node.condition, scope);

        if (condition === UNKNOWN) {
            return UNKNOWN;
        }

        return evaluate(condition ? node.whenTrue : node.whenFalse, scope);
    }

    if (ts.isBinaryExpression(node)) {
        let left = evaluate(node.left, scope);

        if (left === UNKNOWN) {
            return UNKNOWN;
        }

        let right = evaluate(node.right, scope);

        if (right === UNKNOWN) {
            return UNKNOWN;
        }

        switch (node.operatorToken.kind) {
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
                return left === right;

            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                return left !== right;

            case ts.SyntaxKind.PlusToken:
                if (typeof left === 'string' || typeof right === 'string') {
                    return String(left) + String(right);
                }

                if (typeof left === 'number' && typeof right === 'number') {
                    return left + right;
                }
        }
    }

    return UNKNOWN;
}

function hasParameters(node: ts.Node): node is ts.Node & { parameters: ts.NodeArray<ts.ParameterDeclaration> } {
    return (node as { parameters?: unknown }).parameters !== undefined;
}

function identifier(node: ts.Identifier, scope: Scope): Primitive | typeof UNKNOWN {
    if (!scope.checker || (scope.names && !scope.names.has(node.text))) {
        return UNKNOWN;
    }

    let symbol = scope.checker.getSymbolAtLocation(node);

    if (!symbol) {
        return UNKNOWN;
    }

    if (scope.values.has(symbol)) {
        return scope.values.get(symbol)!;
    }

    if (scope.visiting.has(symbol)) {
        return UNKNOWN;
    }

    let declaration = symbol.valueDeclaration?.resolve();

    if (!declaration || !isConstDeclaration(declaration)) {
        return UNKNOWN;
    }

    scope.visiting.add(symbol);

    let value = evaluate(declaration.initializer, scope);

    scope.visiting.delete(symbol);

    return value;
}

function immutable(parameter: ts.ParameterDeclaration & { name: ts.Identifier }, symbol: ts.Symbol, checker: ts.Checker): boolean {
    let name = parameter.name.text,
        safe = true;

    // Only a same-named identifier can write the binding; shadowing is ruled out by symbol identity
    let contains = (node: ts.Node): boolean => {
        if (ts.isShorthandPropertyAssignment(node) && (node.name as ts.Identifier).text === name && checker.getShorthandAssignmentValueSymbol(node) === symbol) {
            return true;
        }

        if (ts.isIdentifier(node) && node.text === name && checker.getSymbolAtLocation(node) === symbol) {
            return true;
        }

        return node.forEachChild(contains) === true;
    };

    let visit = (node: ts.Node) => {
        if (!safe) {
            return;
        }

        // Aliased arguments and eval can write a binding without an AST assignment.
        if (ts.isIdentifier(node) && (node.text === 'arguments' || node.text === 'eval')) {
            safe = false;
        }
        else if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
            contains(node.left)
        ) {
            safe = false;
        }
        else if (
            (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
            (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) &&
            contains(node.operand)
        ) {
            safe = false;
        }
        else if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && contains(node.initializer)) {
            safe = false;
        }

        node.forEachChild(visit);
    };

    visit(parameter.parent);

    return safe;
}

function literals(type: ts.Type): Primitive[] | null {
    let types = type.isUnionType() ? type.getTypes() : [type],
        values: Primitive[] = [];

    for (let i = 0, n = types.length; i < n; i++) {
        let member = types[i];

        if (!member.isStringLiteralType() && !member.isNumberLiteralType()) {
            return null;
        }

        values.push(member.value);
    }

    return values.length && values.length <= LIMIT ? values : null;
}

// Every identifier that can resolve to a parameter is bound by an enclosing signature: nested
// callbacks are never walked, so the ancestors' parameter names are the complete candidate set
function parameterNames(node: ts.Node): Set<string> {
    let names = new Set<string>();

    for (let current = node.parent; current; current = current.parent) {
        if (!hasParameters(current)) {
            continue;
        }

        for (let i = 0, n = current.parameters.length; i < n; i++) {
            let name = current.parameters[i].name;

            if (ts.isIdentifier(name)) {
                names.add(name.text);
            }
        }
    }

    return names;
}

// Only strings and numbers fold: runtime bindings treat `false` as "render nothing /
// remove the attribute", which no static text or attribute value can express
function serialize(value: Primitive | typeof UNKNOWN): string | null {
    if (typeof value !== 'number' && typeof value !== 'string') {
        return null;
    }

    let text = String(value);

    return REGEX_SAFE.test(text) ? text : null;
}


const constant = (node: ts.Expression, checker?: ts.Checker, names?: Set<string>): string | null => {
    return serialize(evaluate(node, { checker, names, values: new Map(), visiting: new Set() }));
};

const isConstDeclaration = (node: ts.Node): node is ts.VariableDeclaration & { initializer: ts.Expression } => {
    return ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0;
};

// Enumerating a bounded, immutable parameter gives static clones without copying
// factory bodies across modules or relying on bundler inlining. Unknown runtime
// values still take the original generic binding path.
const specialize = (expressions: ts.Expression[], checker?: ts.Checker, names?: Set<string>): Variant[] => {
    if (!checker || expressions.length === 0) {
        return [];
    }

    let candidates = parameterNames(expressions[0]),
        parameters = new Map<ts.Symbol, { name: string; values: Primitive[] }>();

    if (!candidates.size) {
        return [];
    }

    // Nothing walked here can introduce a binding (function-likes, class bodies and nested
    // templates are skipped), so every identifier shares the template's scope: once a name
    // resolves to a parameter, its other occurrences are the same parameter.
    let visit = (node: ts.Node) => {
        if (hasParameters(node) || ts.isClassExpression(node) || ts.isTaggedTemplateExpression(node)) {
            return;
        }

        if (
            ts.isIdentifier(node) &&
            candidates.has(node.text) &&
            !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
        ) {
            let symbol = checker.getSymbolAtLocation(node),
                declaration = symbol?.valueDeclaration?.resolve();

            if (symbol && declaration && ts.isParameterDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
                let type = checker.getTypeAtLocation(declaration.name),
                    values = type ? literals(type) : null;

                candidates.delete(node.text);

                if (values && immutable(declaration as ts.ParameterDeclaration & { name: ts.Identifier }, symbol, checker)) {
                    parameters.set(symbol, { name: node.text, values });
                }
            }
        }

        node.forEachChild(visit);
    };

    for (let i = 0, n = expressions.length; i < n; i++) {
        visit(expressions[i]);
    }

    if (!parameters.size) {
        return [];
    }

    let combinations = combine(parameters),
        variants: Variant[] = [];

    if (!combinations) {
        return [];
    }

    if (names) {
        names = new Set(names);

        for (let parameter of parameters.values()) {
            names.add(parameter.name);
        }
    }

    for (let i = 0, n = combinations.length; i < n; i++) {
        let { conditions, environment } = combinations[i],
            values = new Map<ts.Expression, string>();

        for (let j = 0, m = expressions.length; j < m; j++) {
            let value = serialize(evaluate(expressions[j], { checker, names, values: environment, visiting: new Set() }));

            if (value !== null) {
                values.set(expressions[j], value);
            }
        }

        if (values.size) {
            variants.push({ condition: conditions.join(' && '), values });
        }
    }

    return variants;
};


export { constant, isConstDeclaration, specialize };
