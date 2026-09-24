import { ts } from '@esportsplus/typescript';
import { imports } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT, isEntrypoint, PACKAGE_NAME } from './constants';
import type { Entrypoint } from './constants';


type Artifacts = {
    calls: ReactiveCallInfo[];
    // Names bound by a `const` declaration anywhere in the file: only these can fold, so any
    // other identifier is rejected without a checker round-trip
    constants: Set<string>;
    templates: TemplateInfo[];
};

// How the file binds the `html` identifier: `imported` by a value import from this package,
// `local` by any other declaration that could shadow it
type Bindings = { imported: boolean; local: boolean };

type ReactiveCallInfo = {
    end: number;
    entrypoint: Entrypoint;
    node: ts.CallExpression;
    start: number;
};

type TemplateInfo = {
    depth: number;
    end: number;
    expressions: ts.Expression[];
    literals: string[];
    node: ts.TaggedTemplateExpression;
    start: number;
};


// Every declaration kind whose `name` introduces a value binding in some scope
const BINDING_KINDS = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.BindingElement,
    ts.SyntaxKind.ClassDeclaration,
    ts.SyntaxKind.ClassExpression,
    ts.SyntaxKind.EnumDeclaration,
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.ImportClause,
    ts.SyntaxKind.ImportEqualsDeclaration,
    ts.SyntaxKind.ImportSpecifier,
    ts.SyntaxKind.ModuleDeclaration,
    ts.SyntaxKind.NamespaceImport,
    ts.SyntaxKind.Parameter,
    ts.SyntaxKind.VariableDeclaration
]);


function bind(node: ts.Node, bindings: Bindings): void {
    if (!BINDING_KINDS.has(node.kind)) {
        return;
    }

    let name = (node as { name?: ts.Node }).name;

    if (!name || !ts.isIdentifier(name) || name.text !== ENTRYPOINT) {
        return;
    }

    if (ts.isImportSpecifier(node) && isPackageImport(node)) {
        bindings.imported = true;
    }
    else {
        bindings.local = true;
    }
}

// Deepest first so a nested template lowers before its parent consumes it, then document
// order for position-deterministic emission
function byDepthThenStart(a: TemplateInfo, b: TemplateInfo): number {
    return a.depth !== b.depth ? b.depth - a.depth : a.start - b.start;
}

// `import { html } from '<package>'` as a value import: specifier.parent is NamedImports,
// then ImportClause, then ImportDeclaration
function isPackageImport(specifier: ts.ImportSpecifier): boolean {
    let clause = specifier.parent.parent,
        declaration = clause.parent;

    return (specifier.propertyName ?? specifier.name).text === ENTRYPOINT &&
        !specifier.isTypeOnly &&
        ts.isImportClause(clause) &&
        clause.phaseModifier !== ts.SyntaxKind.TypeKeyword &&
        ts.isImportDeclaration(declaration) &&
        ts.isStringLiteral(declaration.moduleSpecifier) &&
        declaration.moduleSpecifier.text === PACKAGE_NAME;
}

function nextDepth(node: ts.Node, depth: number): number {
    return (ts.isArrowFunction(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node))
        ? depth + 1
        : depth;
}

function visit(node: ts.Node, depth: number, artifacts: Artifacts, bindings: Bindings): void {
    let entrypoint = entrypointOf(node);

    if (entrypoint) {
        artifacts.calls.push({ end: node.end, entrypoint, node: node as ts.CallExpression, start: node.getStart() });
    }
    else if (isHtmlTemplate(node)) {
        let { expressions, literals } = extractTemplateParts(node.template);

        artifacts.templates.push({ depth, end: node.end, expressions, literals, node, start: node.getStart() });
    }
    else if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
        artifacts.constants.add(node.name.text);
    }

    bind(node, bindings);

    let d = nextDepth(node, depth);

    node.forEachChild(child => visit(child, d, artifacts, bindings));
}


// Syntactic match for `html.reactive(...)` / `html.virtual(...)`; arity is validated where
// the call is lowered so a malformed call fails the build instead of being skipped
const entrypointOf = (node: ts.Node): Entrypoint | null => {
    if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === ENTRYPOINT &&
        isEntrypoint(node.expression.name.text)
    ) {
        return node.expression.name.text;
    }

    return null;
};

const extractTemplateParts = (template: ts.TemplateLiteral): { expressions: ts.Expression[]; literals: string[] } => {
    let expressions: ts.Expression[] = [],
        literals: string[] = [];

    if (ts.isNoSubstitutionTemplateLiteral(template)) {
        literals.push(template.text);
    }
    else if (ts.isTemplateExpression(template)) {
        literals.push(template.head.text);

        for (let i = 0, n = template.templateSpans.length; i < n; i++) {
            let span = template.templateSpans[i];

            expressions.push(span.expression);
            literals.push(span.literal.text);
        }
    }

    return { expressions, literals };
};

// Without a checker every `html` match is accepted. With one, a file that imports `html` from
// this package and declares nothing else by that name provably resolves every use to the
// import; only otherwise does each match pay a symbol round-trip to confirm its origin.
const findTemplateArtifacts = (sourceFile: ts.SourceFile, checker?: ts.Checker): Artifacts => {
    let artifacts: Artifacts = { calls: [], constants: new Set(), templates: [] },
        bindings: Bindings = { imported: false, local: false };

    visit(sourceFile, 0, artifacts, bindings);

    if (checker && (bindings.local || !bindings.imported)) {
        artifacts.calls = artifacts.calls.filter(call =>
            imports.includes(checker, (call.node.expression as ts.PropertyAccessExpression).expression, PACKAGE_NAME, ENTRYPOINT)
        );
        artifacts.templates = artifacts.templates.filter(template =>
            imports.includes(checker, template.node.tag, PACKAGE_NAME, ENTRYPOINT)
        );
    }

    artifacts.templates.sort(byDepthThenStart);

    return artifacts;
};

const isHtmlTemplate = (node: ts.Node): node is ts.TaggedTemplateExpression => {
    return ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === ENTRYPOINT;
};


export { entrypointOf, extractTemplateParts, findTemplateArtifacts, isHtmlTemplate };
export type { Artifacts, ReactiveCallInfo, TemplateInfo };
