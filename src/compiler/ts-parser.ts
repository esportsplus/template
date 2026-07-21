import { ts } from '@esportsplus/typescript';
import { imports } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT, ENTRYPOINT_REACTIVITY, PACKAGE_NAME } from './constants';


type ReactiveCallInfo = {
    arrayArg: ts.Expression;
    callbackArg: ts.Expression;
    end: number;
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


// Deepest first so a nested template lowers before its parent consumes it, then document
// order for position-deterministic emission. Shared by the standalone and combined walks.
function byDepthThenStart(a: TemplateInfo, b: TemplateInfo): number {
    return a.depth !== b.depth ? b.depth - a.depth : a.start - b.start;
}

function matchReactiveCall(node: ts.Node, calls: ReactiveCallInfo[], checker: ts.TypeChecker | undefined): void {
    if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.name.text === ENTRYPOINT_REACTIVITY &&
        node.arguments.length === 2 &&
        node.expression.expression.text === ENTRYPOINT &&
        (!checker || imports.includes(checker, node.expression.expression, PACKAGE_NAME, ENTRYPOINT))
    ) {
        calls.push({
            arrayArg: node.arguments[0],
            callbackArg: node.arguments[1],
            end: node.end,
            node,
            start: node.getStart()
        });
    }
}

function matchTemplate(node: ts.Node, depth: number, templates: TemplateInfo[], checker: ts.TypeChecker | undefined): void {
    if (
        ts.isTaggedTemplateExpression(node) &&
        ts.isIdentifier(node.tag) &&
        node.tag.text === ENTRYPOINT &&
        (!checker || imports.includes(checker, node.tag, PACKAGE_NAME, ENTRYPOINT))
    ) {
        let { expressions, literals } = extractTemplateParts(node.template);

        templates.push({
            depth,
            end: node.end,
            expressions,
            literals,
            node,
            start: node.getStart()
        });
    }
}

function nextDepth(node: ts.Node, depth: number): number {
    return (ts.isArrowFunction(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node))
        ? depth + 1
        : depth;
}

function visitArtifacts(node: ts.Node, depth: number, templates: TemplateInfo[], calls: ReactiveCallInfo[], checker: ts.TypeChecker | undefined): void {
    matchReactiveCall(node, calls, checker);
    matchTemplate(node, depth, templates, checker);

    let d = nextDepth(node, depth);

    ts.forEachChild(node, child => visitArtifacts(child, d, templates, calls, checker));
}

function visitReactiveCalls(node: ts.Node, calls: ReactiveCallInfo[], checker: ts.TypeChecker | undefined): void {
    matchReactiveCall(node, calls, checker);

    ts.forEachChild(node, child => visitReactiveCalls(child, calls, checker));
}

function visitTemplates(node: ts.Node, depth: number, templates: TemplateInfo[], checker: ts.TypeChecker | undefined): void {
    matchTemplate(node, depth, templates, checker);

    let d = nextDepth(node, depth);

    ts.forEachChild(node, child => visitTemplates(child, d, templates, checker));
}


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

const findHtmlTemplates = (sourceFile: ts.SourceFile, checker?: ts.TypeChecker): TemplateInfo[] => {
    let templates: TemplateInfo[] = [];

    visitTemplates(sourceFile, 0, templates, checker);

    return templates.sort(byDepthThenStart);
};

const findReactiveCalls = (sourceFile: ts.SourceFile, checker?: ts.TypeChecker): ReactiveCallInfo[] => {
    let calls: ReactiveCallInfo[] = [];

    visitReactiveCalls(sourceFile, calls, checker);

    return calls;
};

// One AST walk collecting both templates and reactive calls — the transform entrypoint's
// path, replacing a separate findHtmlTemplates + findReactiveCalls pass over the same tree.
const findTemplateArtifacts = (sourceFile: ts.SourceFile, checker?: ts.TypeChecker): { calls: ReactiveCallInfo[]; templates: TemplateInfo[] } => {
    let calls: ReactiveCallInfo[] = [],
        templates: TemplateInfo[] = [];

    visitArtifacts(sourceFile, 0, templates, calls, checker);

    return {
        calls,
        templates: templates.sort(byDepthThenStart)
    };
};


export { extractTemplateParts, findHtmlTemplates, findReactiveCalls, findTemplateArtifacts };
export type { ReactiveCallInfo, TemplateInfo };
