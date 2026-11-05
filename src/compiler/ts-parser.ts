import { ts } from '@esportsplus/typescript';
import { references } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT, isEntrypoint, PACKAGE_NAME, REMOVALS } from './constants';
import type { Entrypoint } from './constants';


type Artifacts = {
    // Names an assignment targets anywhere in the file: a `let` among them may not hold what it was initialized with
    assigned: Set<string>;
    calls: ReactiveCallInfo[];
    // Names bound by a `const` declaration anywhere in the file: only these can fold, so any
    // other identifier is rejected without a checker round-trip
    constants: Set<string>;
    // Other files the sites resolve through (barrels, aliases): a change there can change them
    dependencies: string[];
    // Uses of `html` the compiler cannot lower: anything but a template tag, an
    // html.reactive()/html.virtual() callee, or a const alias of it
    escapes: ts.Node[];
    // Accesses of DOM members that remove or replace nodes, whatever their receiver; see ./removal
    removals: ts.PropertyAccessExpression[];
    // Expressions denoting this package's `html`: `html`, an alias, or `ns.html`
    sites: Set<ts.Node>;
    templates: TemplateInfo[];
};

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


// Any import declaration, dynamic import() or require(): a file without one has no binding from another module
const REGEX_IMPORT = /\bimport\b|\brequire\s*\(/;

// The declarations `html` resolves to: one answer for every file of a program, dropped with the program or its checker;
// concurrent transforms of the program await the one request
const TARGETS = new WeakMap<ts.Program, { checker: ts.Checker; targets: Promise<Set<string>> }>();


// Deepest first so a nested template lowers before its parent consumes it, then document
// order for position-deterministic emission
function byDepthThenStart(a: TemplateInfo, b: TemplateInfo): number {
    return a.depth !== b.depth ? b.depth - a.depth : a.start - b.start;
}

function exported(checker: ts.Checker, program: ts.Program): Promise<Set<string>> {
    let entry = TARGETS.get(program);

    if (entry === undefined || entry.checker !== checker) {
        entry = {
            checker,
            targets: references.exported(checker, program, PACKAGE_NAME, ENTRYPOINT).then(declarations => new Set(declarations.map(references.key)))
        };
        TARGETS.set(program, entry);
    }

    return entry.targets;
}

// A binding that can never be reassigned, so what it was initialized with is what every use sees
function isConst(declaration: ts.Node): boolean {
    let node: ts.Node | undefined = declaration;

    while (node && (ts.isBindingElement(node) || ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node))) {
        node = node.parent;
    }

    return node !== undefined &&
        ts.isVariableDeclaration(node) &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0;
}

// A site the compiler lowers, or a const alias whose own uses are sites in turn
function isLowered(site: ts.Node): boolean {
    let parent = site.parent;

    if (!parent) {
        return false;
    }

    if (ts.isTaggedTemplateExpression(parent)) {
        return parent.tag === site;
    }

    if (ts.isPropertyAccessExpression(parent)) {
        return parent.expression === site &&
            isEntrypoint(parent.name.text) &&
            parent.parent !== undefined &&
            ts.isCallExpression(parent.parent) &&
            parent.parent.expression === parent;
    }

    if (ts.isVariableDeclaration(parent)) {
        // `const h = html` only: `const { reactive } = html` would pull a compile-only member out
        return parent.initializer === site && ts.isIdentifier(parent.name) && isConst(parent);
    }

    return ts.isBindingElement(parent) && parent.propertyName === site && isConst(parent);
}

function nextDepth(node: ts.Node, depth: number): number {
    return (ts.isArrowFunction(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node))
        ? depth + 1
        : depth;
}

// Transform harness (no checker): every identifier named `html` is taken at its word
function syntactic(node: ts.Node, sites: Set<ts.Node>): void {
    if (ts.isIdentifier(node) && node.text === ENTRYPOINT) {
        sites.add(node);
    }

    node.forEachChild(child => syntactic(child, sites));
}

function visit(node: ts.Node, depth: number, artifacts: Artifacts): void {
    let entrypoint = entrypointOf(node, artifacts.sites);

    if (entrypoint) {
        artifacts.calls.push({ end: node.end, entrypoint, node: node as ts.CallExpression, start: node.getStart() });
    }
    else if (isHtmlTemplate(node, artifacts.sites)) {
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
    else if (ts.isPropertyAccessExpression(node) && REMOVALS.has(node.name.text)) {
        artifacts.removals.push(node);
    }
    else if (
        ts.isBinaryExpression(node) &&
        ts.isIdentifier(node.left) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
        artifacts.assigned.add(node.left.text);
    }

    let d = nextDepth(node, depth);

    node.forEachChild(child => visit(child, d, artifacts));
}


// `html.reactive(...)` / `html.virtual(...)` through any site; arity is validated where the call is
// lowered so a malformed call fails the build instead of being skipped
const entrypointOf = (node: ts.Node, sites: Set<ts.Node>): Entrypoint | null => {
    if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        sites.has(node.expression.expression) &&
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

// With a checker, sites are found by resolving every value in the file to its declaration: `html`
// reached through any import, barrel re-export, namespace or const alias is a site, and a
// same-named local never is. Every site the compiler cannot lower is reported as an escape.
const findTemplateArtifacts = async (sourceFile: ts.SourceFile, checker?: ts.Checker, program?: ts.Program): Promise<Artifacts> => {
    let artifacts: Artifacts = {
            assigned: new Set(),
            calls: [],
            constants: new Set(),
            dependencies: [],
            escapes: [],
            removals: [],
            sites: new Set(),
            templates: []
        };

    if (checker && program) {
        // A file that imports nothing cannot reach `html`: no site, template or escape to find
        if (!REGEX_IMPORT.test(sourceFile.text)) {
            return artifacts;
        }

        let targets = await exported(checker, program);

        if (targets.size > 0) {
            let dependencies = new Set<string>(),
                origins = [...await references.origins(checker, program, sourceFile)],
                held = await Promise.all(origins.map(([, origin]) => references.holds(checker, program, origin, targets))),
                self = sourceFile.fileName.toLowerCase();

            for (let i = 0, n = origins.length; i < n; i++) {
                if (!held[i]) {
                    continue;
                }

                let [identifier, origin] = origins[i];

                let parent = identifier.parent!;

                // `ns.html` / `ns['html']` is the site, not its member name
                artifacts.sites.add(
                    (ts.isPropertyAccessExpression(parent) && parent.name === identifier) ||
                    (ts.isElementAccessExpression(parent) && parent.argumentExpression === identifier)
                        ? parent
                        : identifier
                );

                for (let file of [...origin.through, origin.declaration.path]) {
                    if (file.toLowerCase() !== self) {
                        dependencies.add(file);
                    }
                }
            }

            artifacts.dependencies = [...dependencies];
        }

        for (let site of artifacts.sites) {
            if (!isLowered(site)) {
                artifacts.escapes.push(site);
            }
        }
    }
    else {
        syntactic(sourceFile, artifacts.sites);
    }

    visit(sourceFile, 0, artifacts);

    artifacts.templates.sort(byDepthThenStart);

    return artifacts;
};

const isHtmlTemplate = (node: ts.Node, sites: Set<ts.Node>): node is ts.TaggedTemplateExpression => {
    return ts.isTaggedTemplateExpression(node) && sites.has(node.tag);
};

// Past the wrappers that compile to nothing: parentheses, type assertions and non-null assertions
const unwrap = (node: ts.Expression): ts.Expression => {
    while (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isNonNullExpression(node)
    ) {
        node = node.expression;
    }

    return node;
};


export { entrypointOf, extractTemplateParts, findTemplateArtifacts, isHtmlTemplate, unwrap };
export type { Artifacts, ReactiveCallInfo, TemplateInfo };
