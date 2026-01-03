import type { ReactiveCallInfo, TemplateInfo } from './ts-parser';
import { applyReplacementsReverse } from '~/library/transformer-utils';
import type { Replacement } from '~/library/transformer-utils';
import ts from 'typescript';
import parser from './parser';
import { analyzeExpression, generateAttributeBinding, generateSpreadBindings } from './ts-type-analyzer';


type AttributeSlot = {
    attributes: {
        names: string[];
        statics: Record<string, string>;
    };
    path: string[];
    type: 'attributes';
};

type CodegenResult = {
    changed: boolean;
    code: string;
};

type NodeSlot = {
    path: string[];
    type: 'slot';
};

type ParseResult = {
    html: string;
    slots: (AttributeSlot | NodeSlot)[] | null;
};


let currentChecker: ts.TypeChecker | undefined,
    hoistedFactories = new Map<string, string>(),
    htmlToTemplateId = new Map<string, string>(),
    needsArraySlot = false,
    needsEffectSlot = false,
    needsSlot = false,
    templateCounter = 0;


function generateReactiveInlining(
    calls: ReactiveCallInfo[],
    code: string,
    sourceFile: ts.SourceFile
): string {
    if (calls.length === 0) {
        return code;
    }

    let printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }),
        result = code;

    for (let i = calls.length - 1; i >= 0; i--) {
        let call = calls[i];

        result = result.slice(0, call.start);
        result += `new ArraySlot(
                ${printer.printNode(ts.EmitHint.Expression, call.arrayArg, sourceFile)},
                ${printer.printNode(ts.EmitHint.Expression, call.callbackArg, sourceFile)}
            )`;
        result += result.slice(call.end);
    }

    return result;
}

function needsArraySlotImport(code: string): boolean {
    return code.includes('new ArraySlot(') && !code.includes('import') ||
           (code.includes('new ArraySlot(') && !code.includes('ArraySlot'));
}

function addArraySlotImport(code: string): string {
    if (
        code.includes('ArraySlot') &&
        code.includes('import') &&
        code.match(/import\s*\{[^}]*ArraySlot[^}]*\}\s*from/)
    ) {
        return code;
    }

    let firstImport = code.indexOf('import ');

    return `
        import { ArraySlot } from '~/slot/array';

        ${
            firstImport === -1
                ? code
                : `
                    ${code.slice(0, firstImport)}
                    ${code.slice(firstImport)}
                `
        }
    `;
}

function setTypeChecker(checker: ts.TypeChecker | undefined): void {
    currentChecker = checker;
}

// Get or create template ID for given HTML (deduplication)
function getOrCreateTemplateId(html: string): string {
    let id = htmlToTemplateId.get(html);

    if (!id) {
        id = `__tmpl_${templateCounter++}`;

        hoistedFactories.set(id, html);
        htmlToTemplateId.set(html, id);
    }

    return id;
}

// Check if expression is a nested html tagged template
function isNestedHtmlTemplate(expr: ts.Expression): expr is ts.TaggedTemplateExpression {
    return ts.isTaggedTemplateExpression(expr) &&
           ts.isIdentifier(expr.tag) &&
           expr.tag.text === 'html';
}

// Recursively generate code for a nested html template
function generateNestedTemplateCode(
    node: ts.TaggedTemplateExpression,
    sourceFile: ts.SourceFile
): string {
    let expressions: ts.Expression[] = [],
        exprTexts: string[] = [],
        literals: string[] = [],
        printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }),
        template = node.template;

    if (ts.isNoSubstitutionTemplateLiteral(template)) {
        literals.push(template.text);
    }
    else if (ts.isTemplateExpression(template)) {
        literals.push(template.head.text);

        for (let i = 0, n = template.templateSpans.length; i < n; i++) {
            let span = template.templateSpans[i],
                expr = span.expression;

            expressions.push(expr);
            literals.push(span.literal.text);

            // For nested templates in expressions, recursively generate
            if (isNestedHtmlTemplate(expr)) {
                exprTexts.push(generateNestedTemplateCode(expr, sourceFile));
            }
            else {
                exprTexts.push(printer.printNode(ts.EmitHint.Expression, expr, sourceFile));
            }
        }
    }

    return generateTemplateCode(
        parser.parse(literals) as ParseResult,
        exprTexts,
        expressions,
        sourceFile,
        false // nested templates are always wrapped in IIFE
    );
}

// Generate node slot binding code
// Uses original ts.Expression for accurate type analysis
function generateNodeBinding(anchor: string, exprText: string, exprNode: ts.Expression | undefined, sourceFile: ts.SourceFile): string {
    if (!exprNode) {
        needsSlot = true;
        return `__slot(${anchor}, ${exprText});`;
    }

    // Handle nested html templates by recursively generating their code
    if (isNestedHtmlTemplate(exprNode)) {
        let nestedCode = generateNestedTemplateCode(exprNode, sourceFile);
        return `${anchor}.parentNode.insertBefore(${nestedCode}, ${anchor});`;
    }

    let slotType = analyzeExpression(exprNode, currentChecker);

    switch (slotType) {
        case 'effect':
            needsEffectSlot = true;
            return `new EffectSlot(${anchor}, ${exprText});`;

        case 'array-slot':
            needsArraySlot = true;
            return `new ArraySlot(${anchor}, ${exprText});`;

        case 'static':
            // Static value - direct textContent assignment
            return `${anchor}.textContent = ${exprText};`;

        case 'document-fragment':
            // Nested html template - append directly
            return `${anchor}.parentNode.insertBefore(${exprText}, ${anchor});`;

        default:
            // 'primitive', 'node', 'unknown' - use runtime slot
            needsSlot = true;
            return `__slot(${anchor}, ${exprText});`;
    }
}

function generateImports(): string {
    let slotImports: string[] = [];

    if (needsArraySlot) {
        slotImports.push(`import { ArraySlot } from '~/slot/array';`);
    }

    if (needsEffectSlot) {
        slotImports.push(`import { EffectSlot } from '~/slot/effect';`);
    }

    if (needsSlot) {
        slotImports.push(`import slot from '~/slot';`);
    }

    return `
        import a from '~/attributes';
        import event from '~/event';
        ${slotImports.join('\n')}

        let _template = document.createElement('template');

        const __fragment = (tmpl: string) => {
            let _frag;

            return () => {
                if (!_frag) {
                    let _t = _template.cloneNode();
                    _t.innerHTML = tmpl;
                    _frag = _t.content;
                }

                return _frag.cloneNode(true);
            };
        };

        const __event = event;
        const __setClassPreparsed = a.setClassPreparsed;
        const __setData = a.setData;
        const __setProperty = a.setProperty;
        const __setStylePreparsed = a.setStylePreparsed;
        const __spread = a.spread;
        ${needsSlot ? `const __slot = slot;` : ''}
    `;
}

function generateTemplateCode(
    { html, slots }: ParseResult,
    exprTexts: string[],
    exprNodes: ts.Expression[],
    sourceFile: ts.SourceFile,
    isArrowBody: boolean
): string {
    // Static template (no slots) - hoist factory and call it
    if (!slots || slots.length === 0) {
        return `${getOrCreateTemplateId(html)}()`;
    }

    let code: string[] = [],
        declarations: string[] = [],
        nodes = new Map<string, string>(),
        varCounter = 0;

    declarations.push(`_root = ${getOrCreateTemplateId(html)}()`);
    nodes.set('', '_root');

    for (let i = 0, n = slots.length; i < n; i++) {
        let path = slots[i].path;

        if (path.length === 0) {
            continue;
        }

        let key = path.join('.');

        if (nodes.has(key)) {
            continue;
        }

        // Find longest cached ancestor
        let ancestorVar = '_root',
            startIdx = 0;

        for (let j = path.length - 1; j >= 0; j--) {
            let prefix = path.slice(0, j).join('.');

            if (nodes.has(prefix)) {
                ancestorVar = nodes.get(prefix)!;
                startIdx = j;
                break;
            }
        }

        // Build path from ancestor
        let name = `_e${varCounter++}`,
            suffix = path.slice(startIdx).join('.');

        declarations.push(`${name} = ${ancestorVar}.${suffix}`);
        nodes.set(key, name);
    }

    code.push(
        isArrowBody
            ? '{'
            : `(() => {`,
        `let ${declarations.join(',\n')};`
    );

    let index = 0;

    for (let i = 0, n = slots.length; i < n; i++) {
        let slot = slots[i],
            elementVar = slot.path.length === 0
                ? '_root'
                : ( nodes.get(slot.path.join('.')) || '_root' );

        if (slot.type === 'attributes') {
            for (let j = 0, m = slot.attributes.names.length; j < m; j++) {
                let name = slot.attributes.names[j];

                if (name === 'spread') {
                    // Use TypeChecker-aware spread unpacking
                    let bindings = generateSpreadBindings(
                            exprNodes[index],
                            exprTexts[index] || 'undefined',
                            elementVar,
                            sourceFile,
                            currentChecker
                        );

                    for (let k = 0, o = bindings.length; k < o; k++) {
                        code.push(bindings[k]);
                    }

                    index++;
                }
                else {
                    code.push(
                        generateAttributeBinding(
                            elementVar,
                            name,
                            exprTexts[index++] || 'undefined',
                            slot.attributes.statics[name] || ''
                        )
                    );
                }
            }
        }
        else {
            code.push(
                generateNodeBinding(elementVar, exprTexts[index] || 'undefined', exprNodes[index], sourceFile)
            );
            index++;
        }
    }

    code.push(`return _root;`);

    if (isArrowBody) {
        code.push(`}`);
    }
    else {
        code.push(`})()`);
    }

    return code.join('\n');
}


// Check if template is nested inside another template's expression
function isNestedTemplate(template: TemplateInfo, allTemplates: TemplateInfo[]): boolean {
    for (let i = 0, n = allTemplates.length; i < n; i++) {
        let other = allTemplates[i];

        if (other === template) {
            continue;
        }

        // Check if this template is inside any of other's expressions
        for (let j = 0, m = other.expressions.length; j < m; j++) {
            let expr = other.expressions[j],
                exprEnd = expr.end,
                exprStart = expr.getStart();

            if (template.start >= exprStart && template.end <= exprEnd) {
                return true;
            }
        }
    }

    return false;
}

// Rewrite expression, replacing nested html templates with generated code
function rewriteExpression(expr: ts.Expression, sourceFile: ts.SourceFile): string {
    let printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

    // Direct nested template
    if (isNestedHtmlTemplate(expr)) {
        return generateNestedTemplateCode(expr, sourceFile);
    }

    // Check if expression contains any nested html templates
    let hasNestedTemplate = false;

    function checkForNestedTemplates(node: ts.Node): void {
        if (isNestedHtmlTemplate(node as ts.Expression)) {
            hasNestedTemplate = true;
        }

        if (!hasNestedTemplate) {
            ts.forEachChild(node, checkForNestedTemplates);
        }
    }

    checkForNestedTemplates(expr);

    if (!hasNestedTemplate) {
        return printer.printNode(ts.EmitHint.Expression, expr, sourceFile);
    }

    // Has nested templates - rewrite by replacing them in the source text
    let exprStart = expr.getStart(),
        exprText = expr.getText(sourceFile),
        replacements: Replacement[] = [];

    function collectNestedTemplates(node: ts.Node): void {
        if (isNestedHtmlTemplate(node as ts.Expression)) {
            replacements.push({
                end: node.end - exprStart,
                newText: generateNestedTemplateCode(node as ts.TaggedTemplateExpression, sourceFile),
                start: node.getStart() - exprStart
            });
        }
        else {
            ts.forEachChild(node, collectNestedTemplates);
        }
    }

    collectNestedTemplates(expr);

    return applyReplacementsReverse(exprText, replacements);
}

function generateCode(
    templates: TemplateInfo[],
    originalCode: string,
    sourceFile: ts.SourceFile
): CodegenResult {
    if (templates.length === 0) {
        return {
            changed: false,
            code: originalCode
        };
    }

    hoistedFactories.clear();
    htmlToTemplateId.clear();
    needsArraySlot = false;
    needsEffectSlot = false;
    needsSlot = false;
    templateCounter = 0;

    // Filter out nested templates - they'll be processed inline
    let rootTemplates = templates.filter(t => !isNestedTemplate(t, templates));

    if (rootTemplates.length === 0) {
        return {
            changed: false,
            code: originalCode
        };
    }

    let replacements: Replacement[] = [];

    for (let i = 0, n = rootTemplates.length; i < n; i++) {
        let exprTexts: string[] = [],
            template = rootTemplates[i];

        for (let j = 0, m = template.expressions.length; j < m; j++) {
            exprTexts.push(rewriteExpression(template.expressions[j], sourceFile));
        }

        replacements.push({
            end: template.end,
            newText: generateTemplateCode(
                parser.parse(template.literals) as ParseResult,
                exprTexts,
                template.expressions,
                sourceFile,
                originalCode.slice(0, template.start).trimEnd().endsWith('=>')
            ),
            start: template.start
        });
    }

    let code = applyReplacementsReverse(originalCode, replacements),
        changed = replacements.length > 0;

    // Add hoisted factories and imports
    if (changed && hoistedFactories.size > 0) {
        let factories: string[] = [],
            imports = generateImports();

        for (let [id, html] of hoistedFactories) {
            factories.push(`const ${id} = __fragment(\`${html}\`);`);
        }

        code = imports + '\n\n' + factories.join('\n') + '\n\n' + code;
    }

    return { changed, code };
}


export { addArraySlotImport, generateCode, generateReactiveInlining, needsArraySlotImport, setTypeChecker };
export type { CodegenResult };
