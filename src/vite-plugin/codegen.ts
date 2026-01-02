// Phase 1, 2, 3, 4: Code Generation
// Transforms parsed templates into optimized runtime code
// - Pre-compiled template fragments (Phase 1)
// - Ancestor-aware path traversal (Phase 1)
// - Static template bypass (Phase 2)
// - Nested template hoisting (Phase 2)
// - Attribute handler specialization (Phase 3)
// - Class/style pre-parsing (Phase 3)
// - Spread unpacking (Phase 3)
// - Type analysis and pre-wiring (Phase 4)


import type { ParsedTemplate, PathStep } from './parser';
import type { ReactiveCallInfo } from './ts-parser';

import ts from 'typescript';
import { extractNestedTemplates, parseTemplate } from './parser';
import { analyzeExpressionString, generateUnpackedSpreadBindings } from './ts-type-analyzer';


// Module-level TypeChecker for deeper analysis when available
let currentChecker: ts.TypeChecker | undefined;


// Phase 2: Generate html.reactive → new ArraySlot inlining
// Transforms html.reactive(arr, fn) calls into direct new ArraySlot(arr, fn) instantiation
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

    // Process in reverse order to preserve positions
    for (let i = calls.length - 1; i >= 0; i--) {
        let call = calls[i],
            arrExpr = printer.printNode(ts.EmitHint.Expression, call.arrayArg, sourceFile),
            cbExpr = printer.printNode(ts.EmitHint.Expression, call.callbackArg, sourceFile);

        result = result.slice(0, call.start) +
                 `new ArraySlot(${arrExpr}, ${cbExpr})` +
                 result.slice(call.end);
    }

    return result;
}

// Check if code needs ArraySlot import after reactive inlining
function needsArraySlotImport(code: string): boolean {
    return code.includes('new ArraySlot(') && !code.includes('import') ||
           (code.includes('new ArraySlot(') && !code.includes('ArraySlot'));
}

// Add ArraySlot import if not present
function addArraySlotImport(code: string): string {
    // Check if ArraySlot is already imported
    if (code.includes('ArraySlot') && code.includes('import')) {
        // Check if it's actually imported, not just used
        let importMatch = code.match(/import\s*\{[^}]*ArraySlot[^}]*\}\s*from/);

        if (importMatch) {
            return code;
        }
    }

    // Find first import statement
    let firstImport = code.indexOf('import ');

    if (firstImport === -1) {
        // No imports, add at beginning
        return `import { ArraySlot } from '~/slot/array';\n\n${code}`;
    }

    // Add before first import
    return code.slice(0, firstImport) +
           `import { ArraySlot } from '~/slot/array';\n` +
           code.slice(firstImport);
}


type CodegenResult = {
    changed: boolean;
    code: string;
    hoistedCode: string;
    templates: ParsedTemplate[];
};


type MixedAttribute = {
    index: number;
    name: string;
    parts: string[];
};

let hoistedFactories = new Map<string, string>(),
    htmlToTemplateId = new Map<string, string>(),
    needsEffectSlot = false,
    REGEX_DYNAMIC_ATTR = /\s+([a-zA-Z][\w-]*)=["']?\{\{\$\}\}["']?/g,
    REGEX_MIXED_ATTR = /\s+([a-zA-Z][\w-]*)=(["'])([^"']*\{\{\$\}\}[^"']*)\2/g,
    REGEX_SPREAD_ATTR = /\s+\{\{\$\}\}/g,
    REGEX_SLOT_MARKER = /\{\{\$\}\}/g,
    SLOT_COMMENT = '<!--$-->';


// Issue 14: Detect if expression is a function using TS AST analysis
// Uses TypeChecker when available for variable type inference
function isEffectExpression(expr: string): boolean {
    return analyzeExpressionString(expr, currentChecker) === 'effect';
}

// Set the TypeChecker for deeper analysis (called per-transform)
function setTypeChecker(checker: ts.TypeChecker | undefined): void {
    currentChecker = checker;
}


// Issue 10: Extract mixed attributes (static + dynamic content) before stripping
// Returns array of { name, parts } where parts are the static pieces around {{$}}
function extractMixedAttributes(html: string): MixedAttribute[] {
    let match: RegExpExecArray | null,
        result: MixedAttribute[] = [],
        slotIndex = 0;

    // Count slots to track indices
    REGEX_SLOT_MARKER.lastIndex = 0;

    while ((match = REGEX_SLOT_MARKER.exec(html)) !== null) {
        // Check if this slot is inside an attribute with mixed content
        let before = html.slice(0, match.index),
            lastTagStart = before.lastIndexOf('<'),
            lastTagEnd = before.lastIndexOf('>');

        if (lastTagStart > lastTagEnd) {
            // Inside a tag - check for mixed attribute pattern
            let tagContent = html.slice(lastTagStart, html.indexOf('>', lastTagStart) + 1),
                attrMatch: RegExpExecArray | null;

            REGEX_MIXED_ATTR.lastIndex = 0;

            while ((attrMatch = REGEX_MIXED_ATTR.exec(tagContent)) !== null) {
                let attrValue = attrMatch[3];

                // Only process if this has both static and dynamic parts
                if (attrValue !== '{{$}}' && attrValue.includes('{{$}}')) {
                    let parts = attrValue.split('{{$}}'),
                        existingIdx = result.findIndex(a => a.name === attrMatch![1]);

                    if (existingIdx === -1) {
                        result.push({
                            index: slotIndex,
                            name: attrMatch[1],
                            parts
                        });
                    }
                }
            }
        }

        slotIndex++;
    }

    return result;
}

// Strip dynamic attributes from HTML, keeping only static content
// Issue 9: Replace {{$}} text markers with <!--$--> comment markers
// Issue 10: Also strip mixed static/dynamic attributes
function stripDynamicAttributes(html: string): string {
    return html
        .replace(REGEX_MIXED_ATTR, '')
        .replace(REGEX_DYNAMIC_ATTR, '')
        .replace(REGEX_SPREAD_ATTR, '')
        .replace(REGEX_SLOT_MARKER, SLOT_COMMENT);
}


// #9: Nested Template Hoisting
// Detect html`...` inside html`...` and hoist to module scope
function hoistNestedTemplates(templates: ParsedTemplate[], code: string): { code: string; hoistedCode: string[] } {
    let hoisted: string[] = [];

    // Find nested template patterns and hoist them
    // For now, we identify templates that could be hoisted
    for (let i = 0, n = templates.length; i < n; i++) {
        let template = templates[i];

        if (template.hasNestedTemplates) {
            template.hoistedId = `__hoisted_${template.id}`;
        }
    }

    return { code, hoistedCode: hoisted };
}

// Main code generation function
function generateCode(templates: ParsedTemplate[], originalCode: string): CodegenResult {
    if (templates.length === 0) {
        return {
            changed: false,
            code: originalCode,
            hoistedCode: '',
            templates: []
        };
    }

    // Clear caches from previous runs
    hoistedFactories.clear();
    htmlToTemplateId.clear();
    needsEffectSlot = false;

    let changed = false,
        code = originalCode,
        hoistedCode: string[] = [],
        offset = 0;

    // Process nested templates first (Phase 2)
    let { code: processedCode, hoistedCode: nested } = hoistNestedTemplates(templates, code);

    code = processedCode;
    hoistedCode.push(...nested);

    // Generate replacement code for each template
    for (let i = 0, n = templates.length; i < n; i++) {
        let template = templates[i];

        // #8: Static template bypass
        // Issue 2: Inline __fragment() directly, no hoisted variable needed
        if (template.isStatic) {
            let html = template.html.replace(/{{(\$)}}/g, SLOT_COMMENT),
                replacement = `__fragment(${JSON.stringify(html)})`;

            // Replace original template literal with inline fragment factory
            let start = template.start + offset,
                end = template.end + offset;

            code = code.slice(0, start) + replacement + code.slice(end);
            offset += replacement.length - (end - start);
            changed = true;

            continue;
        }

        // Extract original value expressions
        let originalSlice = originalCode.slice(template.start, template.end),
            valueExprs = extractValueExpressions(originalSlice);

        // Issue 4: Compile nested html`...` templates in value expressions
        for (let j = 0, m = valueExprs.length; j < m; j++) {
            valueExprs[j] = compileNestedTemplates(valueExprs[j], 'nested');
        }

        // Issue 7: Detect if template is arrow function body (preceded by =>)
        let beforeTemplate = code.slice(0, template.start + offset).trimEnd(),
            isArrowBody = beforeTemplate.endsWith('=>');

        // For non-static templates, generate optimized inline code
        let inlineCode = generateInlineTemplate(template, valueExprs, isArrowBody);

        // Replace original template literal
        let start = template.start + offset,
            end = template.end + offset;

        code = code.slice(0, start) + inlineCode + code.slice(end);
        offset += inlineCode.length - (end - start);
        changed = true;
    }

    // Generate hoisted factory declarations for dynamic templates
    if (hoistedFactories.size > 0) {
        let factories: string[] = [];

        for (let [id, html] of hoistedFactories) {
            factories.push(`const ${id} = __fragment(${JSON.stringify(html)});`);
        }

        hoistedCode.push(factories.join('\n'));
    }

    // Add imports and hoisted code at the top if we made changes
    if (changed && hoistedCode.length > 0) {
        let imports = generateImports(),
            hoisted = hoistedCode.join('\n\n');

        code = imports + '\n\n' + hoisted + '\n\n' + code;
    }

    return {
        changed,
        code,
        hoistedCode: hoistedCode.join('\n'),
        templates
    };
}

// Generate runtime imports for compiled templates
// Issue 12: Removed unused prototype imports, using native property access
// Issue 14: Conditionally import EffectSlot for function slots
function generateImports(): string {
    let imports = `import a from '~/attributes';
import event from '~/event';`;

    if (needsEffectSlot) {
        imports += `\nimport { EffectSlot } from '~/slot/effect';`;
    }
    else {
        imports += `\nimport slot from '~/slot';`;
    }

    imports += `

let _template = document.createElement('template');

const __fragment = (tmpl: string) => {
    let _frag: DocumentFragment | undefined;

    return () => {
        if (!_frag) {
            let _t = _template.cloneNode() as HTMLTemplateElement;
            _t.innerHTML = tmpl;
            _frag = _t.content;
        }

        return _frag.cloneNode(true) as DocumentFragment;
    };
};

const __setClass = a.setClass;
const __setClassPreparsed = a.setClassPreparsed;
const __setData = a.setData;
const __setProperty = a.setProperty;
const __setStyle = a.setStyle;
const __setStylePreparsed = a.setStylePreparsed;
const __spread = a.spread;
const __event = event;`;

    if (!needsEffectSlot) {
        imports += `\nconst __slot = slot;`;
    }

    return imports;
}

// Extract ${...} expressions from template literal string
function extractValueExpressions(templateStr: string): string[] {
    let depth = 0,
        exprs: string[] = [],
        exprStart = -1,
        inTemplate = false;

    for (let i = 0, n = templateStr.length; i < n; i++) {
        let char = templateStr[i];

        if (!inTemplate && char === '`') {
            inTemplate = true;
            continue;
        }

        if (inTemplate && char === '`' && depth === 0) {
            break;
        }

        if (inTemplate) {
            if (char === '$' && templateStr[i + 1] === '{' && depth === 0) {
                exprStart = i + 2;
                depth = 1;
                i++;
                continue;
            }

            if (depth > 0) {
                if (char === '{') {
                    depth++;
                }
                else if (char === '}') {
                    depth--;

                    if (depth === 0) {
                        exprs.push(templateStr.slice(exprStart, i));
                        exprStart = -1;
                    }
                }
            }
        }
    }

    return exprs;
}

// Issue 6: Build ancestor-cached path declarations
// Identifies common path prefixes and caches them to avoid redundant DOM traversal
function buildAncestorCachedPaths(
    paths: PathStep[][],
    rootVar: string
): { declarations: string[]; pathVars: Map<string, string> } {
    let ancestorCounter = 0,
        ancestorVars = new Map<string, string>(),
        declarations: string[] = [],
        elementCounter = 0,
        pathVars = new Map<string, string>();

    // Collect all unique path prefixes
    let prefixes = new Set<string>();

    for (let i = 0, n = paths.length; i < n; i++) {
        let path = paths[i];

        for (let j = 1; j <= path.length; j++) {
            prefixes.add(JSON.stringify(path.slice(0, j)));
        }
    }

    // Count how many times each prefix is used
    let prefixUsage = new Map<string, number>();

    for (let prefixKey of prefixes) {
        let count = 0;

        for (let i = 0, n = paths.length; i < n; i++) {
            let pathKey = JSON.stringify(paths[i]);

            if (pathKey.startsWith(prefixKey.slice(0, -1)) || pathKey === prefixKey) {
                count++;
            }
        }

        prefixUsage.set(prefixKey, count);
    }

    // Sort prefixes by length (shortest first) for proper generation order
    let sortedPrefixes = Array.from(prefixes).sort((a, b) => {
        let aPath = JSON.parse(a) as PathStep[],
            bPath = JSON.parse(b) as PathStep[];

        return aPath.length - bPath.length;
    });

    // Generate ancestor variables for shared prefixes (used > 1 time)
    for (let prefixKey of sortedPrefixes) {
        let usage = prefixUsage.get(prefixKey) || 0;

        if (usage <= 1) {
            continue;
        }

        let path = JSON.parse(prefixKey) as PathStep[];

        if (path.length === 0) {
            continue;
        }

        // Find the parent prefix variable
        let parentKey = JSON.stringify(path.slice(0, -1)),
            parentVar = path.length === 1 ? rootVar : (ancestorVars.get(parentKey) || rootVar),
            lastStep = path[path.length - 1],
            traversal = generateSingleStepTraversal(lastStep, parentVar),
            ancestorVar = `_a${ancestorCounter++}`;

        ancestorVars.set(prefixKey, ancestorVar);
        declarations.push(`${ancestorVar} = ${traversal}`);
    }

    // Generate element variables for each unique path
    for (let i = 0, n = paths.length; i < n; i++) {
        let path = paths[i],
            pathKey = JSON.stringify(path);

        if (pathVars.has(pathKey)) {
            continue;
        }

        if (path.length === 0) {
            pathVars.set(pathKey, rootVar);
            continue;
        }

        // Check if this path has a cached ancestor
        let ancestorVar = ancestorVars.get(pathKey);

        if (ancestorVar) {
            pathVars.set(pathKey, ancestorVar);
            continue;
        }

        // Find longest matching ancestor
        let longestAncestor = rootVar,
            remainingPath = path;

        for (let j = path.length - 1; j >= 1; j--) {
            let prefixKey = JSON.stringify(path.slice(0, j)),
                prefixVar = ancestorVars.get(prefixKey);

            if (prefixVar) {
                longestAncestor = prefixVar;
                remainingPath = path.slice(j);
                break;
            }
        }

        // Generate traversal from longest ancestor
        let elementVar = `_e${elementCounter++}`,
            traversal = generatePathTraversalInline(remainingPath, longestAncestor);

        pathVars.set(pathKey, elementVar);
        declarations.push(`${elementVar} = ${traversal}`);
    }

    return { declarations, pathVars };
}

// Generate traversal for a single path step
// Issue 12: Use native property access instead of .call()
function generateSingleStepTraversal(step: PathStep, fromVar: string): string {
    let result = `${fromVar}.${step.method}`;

    if (step.count > 0) {
        let sibMethod = step.method === 'firstChild' ? 'nextSibling' :
                       step.method === 'firstElementChild' ? 'nextElementSibling' : step.method;

        for (let j = 0; j < step.count; j++) {
            result = `${result}.${sibMethod}`;
        }
    }

    return result;
}

// Issue 4 & 13: Compile nested html`...` templates in value expressions
// Finds nested templates, hoists their factories, and replaces with compiled code
// Issue 13: Recursively compiles nested templates within .map(), ternaries, etc.
function compileNestedTemplates(expression: string, fileId: string, depth: number = 0): string {
    // Prevent infinite recursion
    if (depth > 10) {
        return expression;
    }

    let nested = extractNestedTemplates(expression);

    if (nested.length === 0) {
        return expression;
    }

    let result = expression,
        offset = 0;

    for (let i = 0, n = nested.length; i < n; i++) {
        let { content, end, start } = nested[i];

        // Parse the nested template
        let nestedParsed = parseTemplate(content, fileId);

        if (nestedParsed.length === 0) {
            continue;
        }

        let nestedTemplate = nestedParsed[0],
            nestedHtml = stripDynamicAttributes(nestedTemplate.html);

        // Issue 11: Use template deduplication for nested templates
        let templateId = getOrCreateTemplateId(nestedHtml, nestedTemplate.id);

        // Generate replacement code for the nested template
        let replacement: string;

        if (nestedTemplate.isStatic) {
            // Static nested template - just call the factory
            replacement = `${templateId}()`;
        }
        else {
            // Dynamic nested template - generate inline code
            // Extract expressions from nested template content
            let nestedExprs = extractValueExpressionsFromTemplate(content);

            // Issue 13: Recursively compile nested templates in value expressions
            for (let j = 0, m = nestedExprs.length; j < m; j++) {
                nestedExprs[j] = compileNestedTemplates(nestedExprs[j], fileId, depth + 1);
            }

            replacement = generateNestedTemplateCall(nestedTemplate, nestedExprs, templateId);
        }

        // Replace in result
        let adjustedStart = start + offset,
            adjustedEnd = end + offset;

        result = result.slice(0, adjustedStart) + replacement + result.slice(adjustedEnd);
        offset += replacement.length - (end - start);
    }

    return result;
}

// Extract value expressions from a template literal string (e.g., "html`<div>${expr}</div>`")
function extractValueExpressionsFromTemplate(templateStr: string): string[] {
    // Remove html` prefix and ` suffix
    let content = templateStr.slice(5, -1);

    return extractValueExpressions('`' + content + '`');
}

// Generate a nested template call with bindings
// Issue 11: Accept templateId for deduplication support
function generateNestedTemplateCall(template: ParsedTemplate, valueExprs: string[], templateId?: string): string {
    let id = templateId || template.id,
        slots = template.slots;

    if (slots.length === 0) {
        return `${id}()`;
    }

    // Build inline code for nested template
    let code: string[] = [],
        uniquePaths: PathStep[][] = [],
        seenPaths = new Set<string>();

    for (let i = 0, n = slots.length; i < n; i++) {
        let pathKey = JSON.stringify(slots[i].path);

        if (!seenPaths.has(pathKey)) {
            seenPaths.add(pathKey);
            uniquePaths.push(slots[i].path);
        }
    }

    let { declarations, pathVars } = buildAncestorCachedPaths(uniquePaths, '_r');

    declarations.unshift(`_r = ${id}()`);

    code.push(`((_r, ${declarations.slice(1).map((_, i) => `_n${i}`).join(', ')}) => (`);
    code.push(`    ${declarations.slice(1).map((d, i) => `_n${i} = ${d.split(' = ')[1]}`).join(', ')},`);

    // Generate bindings
    for (let i = slots.length - 1; i >= 0; i--) {
        let slot = slots[i],
            pathKey = JSON.stringify(slot.path),
            elementVar = pathVars.get(pathKey) || '_r',
            valueExpr = valueExprs[slot.index] || 'undefined';

        // Replace element var with _r or _nX
        let actualVar = elementVar === '_r' ? '_r' : elementVar.replace('_e', '_n').replace('_a', '_n');

        if (slot.isSpread) {
            code.push(`    __spread(${actualVar}, ${valueExpr}),`);
        }
        else if (slot.isAttribute) {
            if (slot.isEvent) {
                code.push(`    __event(${actualVar}, '${slot.name?.slice(2)}', ${valueExpr}),`);
            }
            else {
                // #4: Use specialized handlers based on attribute name
                let name = slot.name;

                if (name === 'class') {
                    code.push(`    __setClass(${actualVar}, ${valueExpr}),`);
                }
                else if (name === 'style') {
                    code.push(`    __setStyle(${actualVar}, ${valueExpr}),`);
                }
                else if (name && name[0] === 'd' && name.startsWith('data-')) {
                    code.push(`    __setData(${actualVar}, '${name}', ${valueExpr}),`);
                }
                else {
                    code.push(`    __setProperty(${actualVar}, '${name}', ${valueExpr}),`);
                }
            }
        }
        else {
            // Issue 14: Use EffectSlot for function expressions (TS AST analysis)
            if (isEffectExpression(valueExpr)) {
                needsEffectSlot = true;
                code.push(`    new EffectSlot(${actualVar}, ${valueExpr}),`);
            }
            else {
                code.push(`    __slot(${actualVar}, ${valueExpr}),`);
            }
        }
    }

    code.push(`    _r`);
    code.push(`))(${id}())`);

    return code.join('\n');
}

// Issue 11: Get or create template ID for given HTML (deduplication)
function getOrCreateTemplateId(html: string, templateId: string): string {
    let existingId = htmlToTemplateId.get(html);

    if (existingId) {
        return existingId;
    }

    htmlToTemplateId.set(html, templateId);
    hoistedFactories.set(templateId, html);

    return templateId;
}

// Issue 10: Generate template literal for mixed attribute binding
// Converts parts array and value expression into `${parts[0]}${value}${parts[1]}...`
function generateMixedAttributeBinding(parts: string[], valueExpr: string): string {
    if (parts.length === 2) {
        return `\`${parts[0]}\${${valueExpr}}${parts[1]}\``;
    }

    // Multiple interpolations not supported yet, fall back to first
    return `\`${parts[0]}\${${valueExpr}}${parts[1] || ''}\``;
}

// Generate inline optimized template code
// Issue 7: Generate block body (no IIFE) when used as arrow function body
// Issue 10: Handle mixed static/dynamic attributes with template literals
// Issue 11: Deduplicate identical template HTML
// Produces: { let frag = __tmpl_N(), el_1 = ...; __attr(el_1, 'name', value); return frag; }
function generateInlineTemplate(template: ParsedTemplate, valueExprs: string[], isArrowBody: boolean = false): string {
    let code: string[] = [],
        mixedAttrs = extractMixedAttributes(template.html),
        html = stripDynamicAttributes(template.html),
        slots = template.slots;

    // Issue 11: Get or create deduplicated template ID
    let templateId = getOrCreateTemplateId(html, template.id);

    // Collect unique paths
    let uniquePaths: PathStep[][] = [],
        seenPaths = new Set<string>();

    for (let i = 0, n = slots.length; i < n; i++) {
        let pathKey = JSON.stringify(slots[i].path);

        if (!seenPaths.has(pathKey)) {
            seenPaths.add(pathKey);
            uniquePaths.push(slots[i].path);
        }
    }

    // Issue 6: Build ancestor-cached path declarations
    let { declarations, pathVars } = buildAncestorCachedPaths(uniquePaths, '_root');

    // Add root declaration at the beginning (Issue 11: use deduplicated templateId)
    declarations.unshift(`_root = ${templateId}()`);

    // Issue 7: Use block body for arrow functions, IIFE for expressions
    if (isArrowBody) {
        code.push(`{`);
    }
    else {
        code.push(`(() => {`);
    }

    code.push(`    let ${declarations.join(',\n        ')};`);
    code.push(``);

    // #10: Generate mixed attribute bindings with preparsed handlers
    for (let i = 0, n = mixedAttrs.length; i < n; i++) {
        let mixed = mixedAttrs[i],
            slot = slots.find(s => s.index === mixed.index && s.isAttribute),
            pathKey = slot ? JSON.stringify(slot.path) : '',
            elementVar = pathVars.get(pathKey) || '_root',
            valueExpr = valueExprs[mixed.index] || 'undefined';

        // Use preparsed handlers for class/style, template literal for others
        if (mixed.name === 'class') {
            code.push(`    __setClassPreparsed(${elementVar}, ${JSON.stringify(mixed.parts)}, ${valueExpr});`);
        }
        else if (mixed.name === 'style') {
            code.push(`    __setStylePreparsed(${elementVar}, ${JSON.stringify(mixed.parts)}, ${valueExpr});`);
        }
        else {
            // Fallback for other mixed attributes (rare)
            let templateLiteral = generateMixedAttributeBinding(mixed.parts, valueExpr);

            code.push(`    __setProperty(${elementVar}, '${mixed.name}', ${templateLiteral});`);
        }
    }

    // Build set of mixed attribute indices to skip in regular binding loop
    let mixedIndices = new Set(mixedAttrs.map(m => m.index));

    // Generate bindings (reverse order for correct DOM positioning)
    for (let i = slots.length - 1; i >= 0; i--) {
        let slot = slots[i],
            pathKey = JSON.stringify(slot.path),
            elementVar = pathVars.get(pathKey)!,
            valueExpr = valueExprs[slot.index] || 'undefined';

        // Issue 10: Skip mixed attributes (already handled above)
        if (mixedIndices.has(slot.index) && slot.isAttribute) {
            continue;
        }

        if (slot.isSpread) {
            // Use TS-based spread unpacking for object literals
            let spreadBindings = generateUnpackedSpreadBindings(valueExpr, elementVar);

            for (let j = 0, m = spreadBindings.length; j < m; j++) {
                code.push(spreadBindings[j]);
            }
        }
        else if (slot.isAttribute) {
            if (slot.isEvent) {
                code.push(`    __event(${elementVar}, '${slot.name?.slice(2)}', ${valueExpr});`);
            }
            else {
                // #4: Use specialized handlers based on attribute name
                let name = slot.name;

                if (name === 'class') {
                    code.push(`    __setClass(${elementVar}, ${valueExpr});`);
                }
                else if (name === 'style') {
                    code.push(`    __setStyle(${elementVar}, ${valueExpr});`);
                }
                else if (name && name[0] === 'd' && name.startsWith('data-')) {
                    code.push(`    __setData(${elementVar}, '${name}', ${valueExpr});`);
                }
                else {
                    code.push(`    __setProperty(${elementVar}, '${name}', ${valueExpr});`);
                }
            }
        }
        else {
            // Issue 14: Use EffectSlot for function expressions (TS AST analysis)
            if (isEffectExpression(valueExpr)) {
                needsEffectSlot = true;
                code.push(`    new EffectSlot(${elementVar}, ${valueExpr});`);
            }
            else {
                code.push(`    __slot(${elementVar}, ${valueExpr});`);
            }
        }
    }

    code.push(``);
    code.push(`    return _root;`);

    if (isArrowBody) {
        code.push(`}`);
    }
    else {
        code.push(`})()`);
    }

    return code.join('\n');
}

// Generate inline path traversal expression
// Issue 12: Use native property access instead of .call()
function generatePathTraversalInline(path: PathStep[], rootVar: string): string {
    if (path.length === 0) {
        return rootVar;
    }

    let result = rootVar;

    for (let i = 0, n = path.length; i < n; i++) {
        let step = path[i],
            method = step.method;

        result = `${result}.${method}`;

        if (step.count > 0) {
            let sibMethod = method === 'firstChild' ? 'nextSibling' :
                           method === 'firstElementChild' ? 'nextElementSibling' : method;

            for (let j = 0; j < step.count; j++) {
                result = `${result}.${sibMethod}`;
            }
        }
    }

    return result;
}

export { addArraySlotImport, generateCode, generateReactiveInlining, needsArraySlotImport, setTypeChecker };
export type { CodegenResult };
