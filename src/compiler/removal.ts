import { ts } from '@esportsplus/typescript';
import { REMOVALS } from './constants';
import type { Artifacts } from './ts-parser';


// A flagged access, located by its text and how many times that text occurs before it: the code this runs on may
// have been edited by an earlier plugin, so the caller finds the same occurrence in the source it was given
type Removal = {
    member: string;
    occurrence: number;
    start: number;
    text: string;
};

// Template-bound listeners, mapped to the parameter that holds the element, or -1 for an event handler, whose
// element is `this`
type Handlers = Map<ts.Node, number>;


const ATTRIBUTE = /(?:^|\s)(on[a-z]+)\s*=\s*["']?$/i;

const ELEMENT_PARAMETER: Record<string, number> = { onconnect: 0, ondisconnect: 0, onfirstpaint: 0, ontick: 1 };

// Bounds a chain of variables initialized from one another
const MAX_DEPTH = 8;


function bind(handlers: Handlers, name: string, node: ts.Node) {
    if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node) && !ts.isMethodDeclaration(node)) {
        return;
    }

    handlers.set(node, name in ELEMENT_PARAMETER ? ELEMENT_PARAMETER[name] : -1);
}

function binds(node: ts.BindingName, name: string): boolean {
    if (ts.isIdentifier(node)) {
        return node.text === name;
    }

    for (let element of node.elements) {
        if (!ts.isOmittedExpression(element) && element.name !== undefined && binds(element.name, name)) {
            return true;
        }
    }

    return false;
}

// The declaration of 'name' made directly by 'scope', if any
function declared(scope: ts.Node, name: string): ts.Node | null {
    if (ts.isFunctionLikeDeclaration(scope)) {
        for (let parameter of scope.parameters) {
            if (binds(parameter.name, name)) {
                return parameter;
            }
        }

        // A named function expression sees its own name
        return ts.isFunctionExpression(scope) && scope.name?.text === name ? scope : null;
    }

    if (ts.isBlock(scope) || ts.isSourceFile(scope) || ts.isModuleBlock(scope) || ts.isCaseClause(scope) || ts.isDefaultClause(scope)) {
        for (let statement of scope.statements) {
            if (ts.isVariableStatement(statement)) {
                for (let declaration of statement.declarationList.declarations) {
                    if (binds(declaration.name, name)) {
                        return declaration;
                    }
                }
            }
            else if (
                (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
                statement.name?.text === name
            ) {
                return statement;
            }
        }

        return null;
    }

    if (ts.isForStatement(scope) || ts.isForInStatement(scope) || ts.isForOfStatement(scope)) {
        let initializer = scope.initializer;

        if (initializer && ts.isVariableDeclarationList(initializer)) {
            for (let declaration of initializer.declarations) {
                if (binds(declaration.name, name)) {
                    return declaration;
                }
            }
        }

        return null;
    }

    if (ts.isCatchClause(scope) && scope.variableDeclaration && binds(scope.variableDeclaration.name, name)) {
        return scope.variableDeclaration;
    }

    return null;
}

function handlersOf(artifacts: Artifacts): Handlers {
    let handlers: Handlers = new Map();

    for (let i = 0, n = artifacts.templates.length; i < n; i++) {
        let { expressions, literals } = artifacts.templates[i];

        for (let j = 0, m = expressions.length; j < m; j++) {
            let expression = unwrap(expressions[j]),
                match = ATTRIBUTE.exec(literals[j]);

            if (match) {
                bind(handlers, match[1].toLowerCase(), expression);
                continue;
            }

            // A spread: `<div ${{ onclick() {} }}>`
            if (!ts.isObjectLiteralExpression(expression)) {
                continue;
            }

            for (let property of expression.properties) {
                if (!ts.isPropertyAssignment(property) && !ts.isMethodDeclaration(property)) {
                    continue;
                }

                let key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
                        ? property.name.text.toLowerCase()
                        : '';

                if (key.startsWith('on')) {
                    bind(handlers, key, ts.isPropertyAssignment(property) ? unwrap(property.initializer) : property);
                }
            }
        }
    }

    return handlers;
}

function resolve(identifier: ts.Identifier): ts.Node | null {
    let name = identifier.text,
        node = identifier.parent;

    while (node) {
        let declaration = declared(node, name);

        if (declaration) {
            return declaration;
        }

        node = node.parent;
    }

    return null;
}

// Whether 'node' is statically known to be template output: an html`` result, the element a template-bound listener
// receives, or a variable initialized with one and never reassigned
function traced(node: ts.Expression, artifacts: Artifacts, handlers: Handlers, templates: Set<ts.Node>, depth: number): boolean {
    node = unwrap(node);

    if (depth > MAX_DEPTH) {
        return false;
    }

    if (node.kind === ts.SyntaxKind.ThisKeyword) {
        // Arrows take `this` from where they are written
        let scope = node.parent;

        while (scope && (ts.isArrowFunction(scope) || (!ts.isFunctionLikeDeclaration(scope) && !ts.isClassLikeDeclaration(scope)))) {
            scope = scope.parent;
        }

        return scope !== undefined && handlers.get(scope) === -1;
    }

    if (ts.isTaggedTemplateExpression(node)) {
        return templates.has(node);
    }

    if (!ts.isIdentifier(node)) {
        return false;
    }

    let declaration = resolve(node);

    if (declaration === null) {
        return false;
    }

    if (ts.isParameterDeclaration(declaration)) {
        let fn = declaration.parent,
            index = handlers.get(fn);

        return index !== undefined && index >= 0 && ts.isIdentifier(declaration.name) &&
            ts.isFunctionLikeDeclaration(fn) && fn.parameters[index] === declaration;
    }

    if (
        ts.isVariableDeclaration(declaration) &&
        ts.isIdentifier(declaration.name) &&
        declaration.initializer !== undefined &&
        ts.isVariableDeclarationList(declaration.parent) &&
        ((declaration.parent.flags & ts.NodeFlags.Const) !== 0 || !artifacts.assigned.has(declaration.name.text))
    ) {
        return traced(declaration.initializer, artifacts, handlers, templates, depth + 1);
    }

    return false;
}

function unwrap(node: ts.Expression): ts.Expression {
    while (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isNonNullExpression(node)
    ) {
        node = node.expression;
    }

    return node;
}


// Calls and writes that remove or replace template-owned nodes by hand, only where the receiver is traceable to
// template output; anything else (raw DOM, values of unknown origin) is left alone
const findRemovals = (artifacts: Artifacts, sourceFile: ts.SourceFile): Removal[] => {
    if (artifacts.removals.length === 0 || artifacts.templates.length === 0) {
        return [];
    }

    let handlers = handlersOf(artifacts),
        removals: Removal[] = [],
        templates = new Set<ts.Node>(),
        text = sourceFile.text;

    for (let i = 0, n = artifacts.templates.length; i < n; i++) {
        templates.add(artifacts.templates[i].node);
    }

    for (let i = 0, n = artifacts.removals.length; i < n; i++) {
        let access = artifacts.removals[i],
            member = access.name.text,
            parent = access.parent;

        if (
            REMOVALS.get(member) === 'call'
                ? !ts.isCallExpression(parent) || parent.expression !== access
                : !ts.isBinaryExpression(parent) ||
                    parent.left !== access ||
                    parent.operatorToken.kind < ts.SyntaxKind.FirstAssignment ||
                    parent.operatorToken.kind > ts.SyntaxKind.LastAssignment
        ) {
            continue;
        }

        if (!traced(access.expression, artifacts, handlers, templates, 0)) {
            continue;
        }

        let start = access.getStart(sourceFile),
            snippet = text.slice(start, access.end),
            occurrence = 0;

        for (let at = text.indexOf(snippet); at !== -1 && at < start; at = text.indexOf(snippet, at + 1)) {
            occurrence++;
        }

        removals.push({ member, occurrence, start, text: snippet });
    }

    return removals;
};


export { findRemovals };
export type { Removal };
