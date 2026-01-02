import ts from 'typescript';


interface ReactiveCallInfo {
    arrayArg: ts.Expression;
    callbackArg: ts.Expression;
    end: number;
    node: ts.CallExpression;
    start: number;
}

interface TemplateInfo {
    depth: number;
    end: number;
    expressions: ts.Expression[];
    literals: string[];
    node: ts.TaggedTemplateExpression;
    start: number;
}


function extractTemplateInfo(node: ts.TaggedTemplateExpression, depth: number): TemplateInfo {
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
        depth,
        end: node.end,
        expressions,
        literals,
        node,
        start: node.getStart()
    };
}


const findHtmlTemplates = (sourceFile: ts.SourceFile): TemplateInfo[] => {
    let templates: TemplateInfo[] = [];

    function visit(node: ts.Node, depth: number): void {
        // Track nesting: arrow functions, function expressions, method declarations increase depth
        let nextDepth = depth;

        if (
            ts.isArrowFunction(node) ||
            ts.isFunctionExpression(node) ||
            ts.isFunctionDeclaration(node) ||
            ts.isMethodDeclaration(node)
        ) {
            nextDepth = depth + 1;
        }

        if (ts.isTaggedTemplateExpression(node)) {
            let tag = node.tag;

            // Match `html` tag
            if (ts.isIdentifier(tag) && tag.text === 'html') {
                templates.push(extractTemplateInfo(node, depth));
            }
        }

        ts.forEachChild(node, child => visit(child, nextDepth));
    }

    visit(sourceFile, 0);

    // Sort by depth descending (deepest first) for proper hoisting order
    // Secondary sort by position for stable ordering
    templates.sort((a, b) => {
        if (a.depth !== b.depth) {
            return b.depth - a.depth;
        }

        return a.start - b.start;
    });

    return templates;
}

const findReactiveCalls = (sourceFile: ts.SourceFile): ReactiveCallInfo[] => {
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

// Get all expression texts from a template
const getTemplateExpressions = (info: TemplateInfo, sourceFile: ts.SourceFile): string[] => {
    let exprs: string[] = [];

    for (let i = 0, n = info.expressions.length; i < n; i++) {
        exprs.push(info.expressions[i].getText(sourceFile));
    }

    return exprs;
}


export { findHtmlTemplates, findReactiveCalls, getTemplateExpressions };
export type { ReactiveCallInfo, TemplateInfo };
