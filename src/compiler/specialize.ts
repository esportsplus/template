import { ts } from '@esportsplus/typescript';
import { unwrap } from './ts-parser';


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
async function evaluate(node: ts.Expression, scope: Scope): Promise<Primitive | typeof UNKNOWN> {
    node = unwrap(node);

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
        let condition = await evaluate(node.condition, scope);

        if (condition === UNKNOWN) {
            return UNKNOWN;
        }

        return evaluate(condition ? node.whenTrue : node.whenFalse, scope);
    }

    if (ts.isBinaryExpression(node)) {
        let left = await evaluate(node.left, scope);

        if (left === UNKNOWN) {
            return UNKNOWN;
        }

        let right = await evaluate(node.right, scope);

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

async function identifier(node: ts.Identifier, scope: Scope): Promise<Primitive | typeof UNKNOWN> {
    if (!scope.checker || (scope.names && !scope.names.has(node.text))) {
        return UNKNOWN;
    }

    let symbol = await scope.checker.getSymbolAtLocation(node);

    if (!symbol) {
        return UNKNOWN;
    }

    if (scope.values.has(symbol)) {
        return scope.values.get(symbol)!;
    }

    if (scope.visiting.has(symbol)) {
        return UNKNOWN;
    }

    let declaration = await symbol.valueDeclaration?.resolve();

    if (!declaration || !isConstDeclaration(declaration)) {
        return UNKNOWN;
    }

    scope.visiting.add(symbol);

    let value = await evaluate(declaration.initializer, scope);

    scope.visiting.delete(symbol);

    return value;
}

async function immutable(parameter: ts.ParameterDeclaration & { name: ts.Identifier }, symbol: ts.Symbol, checker: ts.Checker): Promise<boolean> {
    let identifiers: ts.Identifier[] = [],
        name = parameter.name.text,
        safe = true,
        shorthands: ts.ShorthandPropertyAssignment[] = [];

    // What every same-named identifier and shorthand in the function resolves to, in one request
    let named = (node: ts.Node): void => {
        if (ts.isShorthandPropertyAssignment(node) && (node.name as ts.Identifier).text === name) {
            shorthands.push(node);
        }

        if (ts.isIdentifier(node) && node.text === name) {
            identifiers.push(node);
        }

        node.forEachChild(named);
    };

    named(parameter.parent);

    let [symbols, values] = await Promise.all([
            identifiers.length > 0 ? checker.getSymbolAtLocation(identifiers) : [],
            Promise.all(shorthands.map(node => checker.getShorthandAssignmentValueSymbol(node)))
        ]),
        writes = new Set<ts.Node>();

    for (let i = 0, n = identifiers.length; i < n; i++) {
        if (symbols[i] === symbol) {
            writes.add(identifiers[i]);
        }
    }

    for (let i = 0, n = shorthands.length; i < n; i++) {
        if (values[i] === symbol) {
            writes.add(shorthands[i]);
        }
    }

    // Only a same-named identifier can write the binding; shadowing is ruled out by symbol identity
    let contains = (node: ts.Node): boolean => {
        if (writes.has(node)) {
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

async function literals(type: ts.Type): Promise<Primitive[] | null> {
    let types = type.isUnionType() ? await type.getTypes() : [type],
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

// Every use of a candidate name in the expressions, as long as it stays a candidate. Nothing walked here can introduce
// a binding (function-likes, class bodies and nested templates are skipped), so every identifier shares the template's
// scope: once a name resolves to a parameter, its other occurrences are the same parameter.
function uses(expressions: ts.Expression[], candidates: Set<string>, found: (node: ts.Identifier) => void): void {
    let visit = (node: ts.Node) => {
        if (hasParameters(node) || ts.isClassExpression(node) || ts.isTaggedTemplateExpression(node)) {
            return;
        }

        if (
            ts.isIdentifier(node) &&
            candidates.has(node.text) &&
            !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
        ) {
            found(node);
        }

        node.forEachChild(visit);
    };

    for (let i = 0, n = expressions.length; i < n; i++) {
        visit(expressions[i]);
    }
}


const constant = async (node: ts.Expression, checker?: ts.Checker, names?: Set<string>): Promise<string | null> => {
    return serialize(await evaluate(node, { checker, names, values: new Map(), visiting: new Set() }));
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
// 'immutables' remembers, per parameter, what immutable() found: every template under a function asks about the
// same parameters, and each answer walks the whole function body
const specialize = async (expressions: ts.Expression[], immutables: Map<ts.Symbol, Promise<boolean>>, checker?: ts.Checker, names?: Set<string>): Promise<Variant[]> => {
    if (!checker || expressions.length === 0) {
        return [];
    }

    let candidates = parameterNames(expressions[0]),
        parameters = new Map<ts.Symbol, { name: string; values: Primitive[] }>();

    if (!candidates.size) {
        return [];
    }

    // Every use of a candidate name, resolved in one request; a name is dropped at its first use resolving to a
    // parameter, so its later uses are skipped as the walk itself would skip them
    let found: ts.Identifier[] = [];

    uses(expressions, new Set(candidates), (node) => {
        found.push(node);
    });

    let symbols = found.length > 0 ? await checker.getSymbolAtLocation(found) : [],
        declarations = await Promise.all(symbols.map(async symbol => symbol?.valueDeclaration?.resolve())),
        resolved: { declaration: ts.ParameterDeclaration & { name: ts.Identifier }; name: string; symbol: ts.Symbol }[] = [];

    for (let i = 0, n = found.length; i < n; i++) {
        let declaration = declarations[i],
            node = found[i],
            symbol = symbols[i];

        if (!candidates.has(node.text) || !symbol || !declaration || !ts.isParameterDeclaration(declaration) || !ts.isIdentifier(declaration.name)) {
            continue;
        }

        candidates.delete(node.text);
        resolved.push({ declaration: declaration as ts.ParameterDeclaration & { name: ts.Identifier }, name: node.text, symbol });
    }

    if (resolved.length === 0) {
        return [];
    }

    let types = await checker.getTypeAtLocation(resolved.map(({ declaration }) => declaration.name)),
        values = await Promise.all(types.map(async type => type ? literals(type) : null)),
        safe = await Promise.all(resolved.map(async ({ declaration, symbol }, i) => {
            if (!values[i]) {
                return false;
            }

            let known = immutables.get(symbol);

            if (known === undefined) {
                known = immutable(declaration, symbol, checker);
                immutables.set(symbol, known);
            }

            return known;
        }));

    for (let i = 0, n = resolved.length; i < n; i++) {
        if (values[i] && safe[i]) {
            parameters.set(resolved[i].symbol, { name: resolved[i].name, values: values[i]! });
        }
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

    let evaluated = await Promise.all(combinations.map(({ environment }) => Promise.all(
            expressions.map(async (expression) => serialize(await evaluate(expression, { checker, names, values: environment, visiting: new Set() })))
        )));

    for (let i = 0, n = combinations.length; i < n; i++) {
        let { conditions } = combinations[i],
            values = new Map<ts.Expression, string>();

        for (let j = 0, m = expressions.length; j < m; j++) {
            let value = evaluated[i][j];

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
