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


function visitReactiveCalls(node: ts.Node, calls: ReactiveCallInfo[], checker: ts.TypeChecker | undefined): void {
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

    ts.forEachChild(node, child => visitReactiveCalls(child, calls, checker));
}

function visitTemplates(node: ts.Node, depth: number, templates: TemplateInfo[], checker: ts.TypeChecker | undefined): void {
    let nextDepth = (ts.isArrowFunction(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node))
            ? depth + 1
            : depth;

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

    ts.forEachChild(node, child => visitTemplates(child, nextDepth, templates, checker));
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

    return templates.sort((a, b) => a.depth !== b.depth ? b.depth - a.depth : a.start - b.start);
};

const findReactiveCalls = (sourceFile: ts.SourceFile, checker?: ts.TypeChecker): ReactiveCallInfo[] => {
    let calls: ReactiveCallInfo[] = [];

    visitReactiveCalls(sourceFile, calls, checker);

    return calls;
};


export { extractTemplateParts, findHtmlTemplates, findReactiveCalls };
export type { ReactiveCallInfo, TemplateInfo };
