// Phase 1: TS-based Template Finder
// Uses TypeScript Compiler API for reliable template literal detection
// Eliminates edge cases from regex-based parsing

import ts from 'typescript';


interface ReactiveCallInfo {
    arrayArg: ts.Expression;
    callbackArg: ts.Expression;
    end: number;
    node: ts.CallExpression;
    start: number;
}

interface TemplateInfo {
    end: number;
    expressions: ts.Expression[];
    literals: string[];
    node: ts.TaggedTemplateExpression;
    start: number;
}


function extractTemplateInfo(node: ts.TaggedTemplateExpression): TemplateInfo {
    let expressions: ts.Expression[] = [],
        literals: string[] = [],
        template = node.template;

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

    return {
        end: node.end,
        expressions,
        literals,
        node,
        start: node.getStart()
    };
}

function findHtmlTemplates(sourceFile: ts.SourceFile): TemplateInfo[] {
    let templates: TemplateInfo[] = [];

    function visit(node: ts.Node): void {
        if (ts.isTaggedTemplateExpression(node)) {
            let tag = node.tag;

            // Match `html` tag
            if (ts.isIdentifier(tag) && tag.text === 'html') {
                templates.push(extractTemplateInfo(node));
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return templates;
}

function findReactiveCalls(sourceFile: ts.SourceFile): ReactiveCallInfo[] {
    let calls: ReactiveCallInfo[] = [];

    function visit(node: ts.Node): void {
        // Match `html.reactive(arr, fn)`
        if (ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) &&
            node.expression.expression.text === 'html' &&
            node.expression.name.text === 'reactive' &&
            node.arguments.length === 2) {
            calls.push({
                arrayArg: node.arguments[0],
                callbackArg: node.arguments[1],
                end: node.end,
                node,
                start: node.getStart()
            });
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return calls;
}

// Get expression text from source
function getExpressionText(expr: ts.Expression, sourceFile: ts.SourceFile): string {
    return expr.getText(sourceFile);
}

// Get all expression texts from a template
function getTemplateExpressions(info: TemplateInfo, sourceFile: ts.SourceFile): string[] {
    let exprs: string[] = [];

    for (let i = 0, n = info.expressions.length; i < n; i++) {
        exprs.push(getExpressionText(info.expressions[i], sourceFile));
    }

    return exprs;
}


export { findHtmlTemplates, findReactiveCalls, getTemplateExpressions };
export type { ReactiveCallInfo, TemplateInfo };
