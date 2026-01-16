import { ast, uid, type ReplacementIntent } from '@esportsplus/typescript/compiler';
import { pick } from '@esportsplus/utilities';
import type { TemplateInfo } from './ts-parser';
import { analyze } from './ts-analyzer';
import { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS } from '../constants';
import { ENTRYPOINT, ENTRYPOINT_REACTIVITY, NAMESPACE, TYPES } from './constants';
import { extractTemplateParts } from './ts-parser';
import { ts } from '@esportsplus/typescript';
import parser from './parser';


type CodegenContext = {
    checker?: ts.TypeChecker;
    sourceFile: ts.SourceFile;
    templates: Map<string, string>;
};

type CodegenResult = {
    prepend: string[];
    replacements: ReplacementIntent[];
    templates: Map<string, string>;
};

type ParseResult = ReturnType<typeof parser.parse>;

type ParseResultAttributes = Extract<NonNullable<ParseResult['slots']>[number], { type: TYPES.Attribute }>;


let printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });


function collectNestedReplacements(ctx: CodegenContext, node: ts.Node, replacements: { end: number; start: number; text: string }[]): void {
    if (isNestedHtmlTemplate(node as ts.Expression)) {
        replacements.push({
            end: node.end,
            start: node.getStart(ctx.sourceFile),
            text: generateNestedTemplateCode(ctx, node as ts.TaggedTemplateExpression)
        });

        return;
    }

    if (isReactiveCall(node as ts.Expression)) {
        let call = node as ts.CallExpression;

        replacements.push({
            end: node.end,
            start: node.getStart(ctx.sourceFile),
            text: `new ${NAMESPACE}.ArraySlot(
                ${rewriteExpression(ctx, call.arguments[0] as ts.Expression)},
                ${rewriteExpression(ctx, call.arguments[1] as ts.Expression)}
            )`
        });

        return;
    }

    ts.forEachChild(node, child => collectNestedReplacements(ctx, child, replacements));
}

function discoverTemplatesInExpression(ctx: CodegenContext, node: ts.Node): void {
    if (isNestedHtmlTemplate(node as ts.Expression)) {
        let { expressions, literals } = extractTemplateParts((node as ts.TaggedTemplateExpression).template),
            parsed = parser.parse(literals) as ParseResult;

        getTemplateID(ctx, parsed.html);

        for (let i = 0, n = expressions.length; i < n; i++) {
            discoverTemplatesInExpression(ctx, expressions[i]);
        }

        return;
    }

    ts.forEachChild(node, child => discoverTemplatesInExpression(ctx, child));
}

function generateAttributeBinding(element: string, name: string, expr: string, attributes?: string): string {
    if (name.startsWith('on') && name.length > 2) {
        let event = name.slice(2).toLowerCase(),
            key = name.toLowerCase();

        if (LIFECYCLE_EVENTS.has(key)) {
            return `${NAMESPACE}.${key}(${element}, ${expr});`;
        }

        if (DIRECT_ATTACH_EVENTS.has(key)) {
            return `${NAMESPACE}.on(${element}, '${event}', ${expr});`;
        }

        return `${NAMESPACE}.delegate(${element}, '${event}', ${expr});`;
    }

    if (name === 'class' || name === 'style') {
        return `${NAMESPACE}.setList(${element}, '${name}', ${expr}, ${attributes});`;
    }

    return `${NAMESPACE}.setProperty(${element}, '${name}', ${expr});`;
}

function generateNestedTemplateCode(ctx: CodegenContext, node: ts.TaggedTemplateExpression): string {
    let { expressions, literals } = extractTemplateParts(node.template),
        exprTexts: string[] = [];

    for (let i = 0, n = expressions.length; i < n; i++) {
        exprTexts.push(rewriteExpression(ctx, expressions[i]));
    }

    return generateTemplateCode(
        ctx,
        parser.parse(literals) as ParseResult,
        exprTexts,
        expressions,
        node
    );
}

function generateNodeBinding(ctx: CodegenContext, anchor: string, exprText: string, exprNode: ts.Expression | undefined): string {
    if (!exprNode) {
        return `${NAMESPACE}.slot(${anchor}, ${exprText});`;
    }

    if (isNestedHtmlTemplate(exprNode)) {
        return `${anchor}.parentNode!.insertBefore(${generateNestedTemplateCode(ctx, exprNode)}, ${anchor});`;
    }

    switch (analyze(exprNode, ctx.checker)) {
        case TYPES.ArraySlot:
            return `${anchor}.parentNode!.insertBefore(new ${NAMESPACE}.ArraySlot(${exprText}).fragment, ${anchor});`;

        case TYPES.DocumentFragment:
            return `${anchor}.parentNode!.insertBefore(${exprText}, ${anchor});`;

        case TYPES.Effect:
            return `new ${NAMESPACE}.EffectSlot(${anchor}, ${exprText});`;

        case TYPES.Static:
            return `${anchor}.after(${NAMESPACE}.text(${exprText}));`;

        default:
            return `${NAMESPACE}.slot(${anchor}, ${exprText});`;
    }
}

function generateTemplateCode(
    ctx: CodegenContext,
    { html, slots }: ParseResult,
    exprTexts: string[],
    exprNodes: ts.Expression[],
    templateNode: ts.Node
): string {
    if (!slots || slots.length === 0) {
        return `${getTemplateID(ctx, html)}()`;
    }

    let attributes = new Map<number, string>(),
        code: string[] = [],
        declarations: string[] = [],
        index = 0,
        isArrowBody = isArrowExpressionBody(templateNode),
        nodes = new Map<string, string>(),
        root = uid('root');

    declarations.push(`${root} = ${getTemplateID(ctx, html)}()`);
    nodes.set('', root);

    for (let i = 0, n = slots.length; i < n; i++) {
        let path = slots[i].path;

        if (path.length === 0) {
            continue;
        }

        let key = path.join('.');

        if (nodes.has(key)) {
            continue;
        }

        let ancestor = root,
            start = 0;

        for (let j = path.length - 1; j >= 0; j--) {
            let prefix = path.slice(0, j).join('.');

            if (nodes.has(prefix)) {
                ancestor = nodes.get(prefix)!;
                start = j;
                break;
            }
        }

        let name = uid('element'),
            segments = path.slice(start),
            value = `${ancestor}.${segments.join('!.')}`;

        if (ancestor === root && segments[0] === 'firstChild') {
            value = value.replace(`${ancestor}.firstChild!`, `(${root}.firstChild! as ${NAMESPACE}.Element)`);
        }

        declarations.push(`${name} = ${value} as ${NAMESPACE}.Element`);
        nodes.set(key, name);
    }

    code.push(isArrowBody ? '{' : `(() => {`);

    for (let i = 0, n = slots.length; i < n; i++) {
        let element = slots[i].path.length === 0
                ? root
                : (nodes.get(slots[i].path.join('.')) || root),
            slot = slots[i];

        if (slot.type === TYPES.Attribute) {
            let names = slot.attributes.names;

            for (let j = 0, m = names.length; j < m; j++) {
                let name = names[j];

                if (name === TYPES.Attributes) {
                    let exprNode = exprNodes[index];

                    // Object literals can be expanded at compile time
                    if (exprNode && ts.isObjectLiteralExpression(exprNode)) {
                        let canExpand = true,
                            props = exprNode.properties;

                        // Check if all properties can be statically analyzed
                        for (let k = 0, p = props.length; k < p; k++) {
                            let prop = props[k];

                            if (
                                ts.isSpreadAssignment(prop) ||
                                (ts.isPropertyAssignment(prop) && ts.isComputedPropertyName(prop.name)) ||
                                (ts.isShorthandPropertyAssignment(prop) && prop.objectAssignmentInitializer)
                            ) {
                                canExpand = false;
                                break;
                            }
                        }

                        if (canExpand) {
                            for (let k = 0, p = props.length; k < p; k++) {
                                let prop = props[k];

                                if (ts.isPropertyAssignment(prop)) {
                                    let propName = ts.isIdentifier(prop.name)
                                            ? prop.name.text
                                            : ts.isStringLiteral(prop.name)
                                                ? prop.name.text
                                                : null;

                                    if (propName) {
                                        code.push(
                                            generateAttributeBinding(
                                                element,
                                                propName,
                                                rewriteExpression(ctx, prop.initializer),
                                                getAttributes(declarations, i, propName, slot, attributes)
                                            )
                                        );
                                    }
                                }
                                else if (ts.isShorthandPropertyAssignment(prop)) {
                                    let propName = prop.name.text;

                                    code.push(
                                        generateAttributeBinding(
                                            element,
                                            propName,
                                            propName,
                                            getAttributes(declarations, i, propName, slot, attributes)
                                        )
                                    );
                                }
                                else if (ts.isMethodDeclaration(prop) && ts.isIdentifier(prop.name)) {
                                    let propName = prop.name.text;

                                    code.push(
                                        generateAttributeBinding(
                                            element,
                                            propName,
                                            printer.printNode(ts.EmitHint.Expression, prop, ctx.sourceFile),
                                            getAttributes(declarations, i, propName, slot, attributes)
                                        )
                                    );
                                }
                            }
                        }
                        else {
                            code.push(
                                `${NAMESPACE}.setProperties(
                                    ${element}, ${exprTexts[index] || 'undefined'},
                                    ${getAttributes(declarations, i, 'attributes', slot, attributes)}
                                );`
                            );
                        }
                    }
                    else {
                        code.push(
                            `${NAMESPACE}.setProperties(
                                ${element}, ${exprTexts[index] || 'undefined'},
                                ${getAttributes(declarations, i, 'attributes', slot, attributes)}
                            );`
                        );
                    }

                    index++;
                }
                else {
                    code.push(
                        generateAttributeBinding(
                            element,
                            name,
                            exprTexts[index++] || 'undefined',
                            getAttributes(declarations, i, name, slot, attributes)
                        )
                    );
                }
            }
        }
        else {
            code.push(
                generateNodeBinding(ctx, element, exprTexts[index] || 'undefined', exprNodes[index])
            );
            index++;
        }
    }

    code.splice(1, 0, `let ${declarations.join(',\n')};`);
    code.push(`return ${root};`);
    code.push(isArrowBody ? `}` : `})()`);

    return code.join('\n');
}

function getAttributes(declarations: string[], i: number, name: string, slot: ParseResultAttributes, attributes: Map<number, string>): string | undefined {
        if (name !== 'class' && name !== 'attributes' && name !== 'style') {
            return undefined;
        }

        let attribute = attributes.get(i);

        if (!attribute) {
            declarations.push(`${attribute = uid('attributes')} = ${JSON.stringify(pick(slot.attributes.static, ['class', 'style']))}`);
            attributes.set(i, attribute);
        }

        return attribute;
    }

function getTemplateID(ctx: CodegenContext, html: string): string {
    let id = ctx.templates.get(html);

    if (!id) {
        id = uid('template');
        ctx.templates.set(html, id);
    }

    return id;
}

function isArrowExpressionBody(node: ts.Node): boolean {
    return ts.isArrowFunction(node.parent) && (node.parent as ts.ArrowFunction).body === node;
}

function isNestedHtmlTemplate(expr: ts.Expression): expr is ts.TaggedTemplateExpression {
    return ts.isTaggedTemplateExpression(expr) && ts.isIdentifier(expr.tag) && expr.tag.text === ENTRYPOINT;
}

function isReactiveCall(expr: ts.Expression): expr is ts.CallExpression {
    return (
        ts.isCallExpression(expr) &&
        ts.isPropertyAccessExpression(expr.expression) &&
        ts.isIdentifier(expr.expression.expression) &&
        expr.expression.expression.text === ENTRYPOINT &&
        expr.expression.name.text === ENTRYPOINT_REACTIVITY
    );
}


const generateCode = (templates: TemplateInfo[], sourceFile: ts.SourceFile, checker?: ts.TypeChecker, callRanges: { end: number; start: number }[] = []): CodegenResult => {
    let result: CodegenResult = {
            prepend: [],
            replacements: [],
            templates: new Map()
        };

    if (templates.length === 0) {
        return result;
    }

    let ranges: { end: number; start: number }[] = [...callRanges];

    for (let i = 0, n = templates.length; i < n; i++) {
        let exprs = templates[i].expressions;

        for (let j = 0, m = exprs.length; j < m; j++) {
            ranges.push({ end: exprs[j].end, start: exprs[j].getStart(sourceFile) });
        }
    }

    let root = templates.filter(t => !ast.inRange(ranges, t.node.getStart(sourceFile), t.node.end));

    if (root.length === 0) {
        return result;
    }

    let ctx: CodegenContext = {
            checker,
            sourceFile,
            templates: result.templates
        };

    for (let i = 0, n = root.length; i < n; i++) {
        let exprTexts: string[] = [],
            parsed = parser.parse(root[i].literals) as ParseResult,
            template = root[i];

        for (let j = 0, m = template.expressions.length; j < m; j++) {
            exprTexts.push(rewriteExpression(ctx, template.expressions[j]));
        }

        if (
            isArrowExpressionBody(template.node) &&
            (template.node.parent as ts.ArrowFunction).parameters.length === 0 &&
            (!parsed.slots || parsed.slots.length === 0)
        ) {
            let code = getTemplateID(ctx, parsed.html);

            result.replacements.push({
                generate: () => code,
                node: template.node
            });
        }
        else {
            let code = generateTemplateCode(ctx, parsed, exprTexts, template.expressions, template.node);

            result.replacements.push({
                generate: () => code,
                node: template.node
            });
        }
    }

    for (let i = 0, n = templates.length; i < n; i++) {
        getTemplateID(ctx, parser.parse(templates[i].literals).html);

        for (let j = 0, m = templates[i].expressions.length; j < m; j++) {
            discoverTemplatesInExpression(ctx, templates[i].expressions[j]);
        }
    }

    for (let [html, id] of ctx.templates) {
        result.prepend.push(`const ${id} = ${NAMESPACE}.template(\`${html}\`);`);
    }

    return result;
};

const rewriteExpression = (ctx: CodegenContext, expr: ts.Expression): string => {
    if (isNestedHtmlTemplate(expr)) {
        return generateNestedTemplateCode(ctx, expr);
    }

    if (isReactiveCall(expr)) {
        return `${rewriteExpression(ctx, expr.arguments[0] as ts.Expression)}, ${rewriteExpression(ctx, expr.arguments[1] as ts.Expression)}`;
    }

    if (!ast.test(expr, n => isNestedHtmlTemplate(n as ts.Expression) || isReactiveCall(n as ts.Expression))) {
        return printer.printNode(ts.EmitHint.Expression, expr, ctx.sourceFile);
    }

    let replacements: { end: number; start: number; text: string }[] = [],
        start = expr.getStart(ctx.sourceFile),
        text = expr.getText(ctx.sourceFile);

    ts.forEachChild(expr, child => collectNestedReplacements(ctx, child, replacements));

    replacements.sort((a, b) => b.start - a.start);

    for (let i = 0, n = replacements.length; i < n; i++) {
        let r = replacements[i];

        text = text.slice(0, r.start - start) + r.text + text.slice(r.end - start);
    }

    return text;
}


export { generateCode, printer, rewriteExpression };
export type { CodegenResult };
