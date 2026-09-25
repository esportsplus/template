import { ts } from '@esportsplus/typescript';
import { ast, uid, type ReplacementIntent } from '@esportsplus/typescript/compiler';
import { ANCHOR_LAST, ANCHOR_SOLE, DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS } from '../constants';
import { cached } from './checker';
import { ENTRYPOINT_VIRTUAL, NAMESPACE, PACKAGE_NAME, SIGNAL, TYPES } from './constants';
import type { Entrypoint } from './constants';
import { analyze, fold, selectorComparison } from './ts-analyzer';
import { entrypointOf, extractTemplateParts, isHtmlTemplate } from './ts-parser';
import type { Artifacts } from './ts-parser';
import parser from './parser';
import { specialize } from './specialize';


type CodegenContext = {
    checker?: ts.Checker;
    constants?: Set<string>;
    // Root of a specialized variant: it must lower to an expression, never an arrow block body
    expression?: ts.Node;
    parseCache?: Map<string, ParseResult>;
    prefoldCache?: WeakMap<ts.Node, Prefolded>;
    selectorFired?: boolean;
    sourceFile: ts.SourceFile;
    // Expressions denoting `html` (see Artifacts.sites)
    sites: Set<ts.Node>;
    staticValues?: Map<ts.Expression, string>;
    templates: Map<string, string>;
};

type CodegenResult = {
    prepend: string[];
    replacements: ReplacementIntent[];
    selectorFired: boolean;
    templates: Map<string, string>;
};

type ParseResult = ReturnType<typeof parser.parse>;

type Prefolded = { expressions: ts.Expression[]; literals: string[] };

type Range = { end: number; start: number };


const REGEX_ATTRIBUTE_VALUE_OPEN = /=\s*(["']?)$/;

const REGEX_UNQUOTED_VALUE_CLOSE = /^(?:[\s>]|\/>)/;


function collectNestedReplacements(ctx: CodegenContext, node: ts.Node, replacements: (Range & { text: string })[], inObserver: boolean): void {
    if (isHtmlTemplate(node, ctx.sites)) {
        replacements.push({
            end: node.end,
            start: node.getStart(ctx.sourceFile),
            text: generateNestedTemplateCode(ctx, node)
        });

        return;
    }

    let entrypoint = entrypointOf(node, ctx.sites);

    if (entrypoint) {
        // Slots nested in arbitrary expressions have no provable parent element,
        // so they never receive the sole-child flag
        replacements.push({
            end: node.end,
            start: node.getStart(ctx.sourceFile),
            text: generateSlotCode(ctx, node as ts.CallExpression, entrypoint, false)
        });

        return;
    }

    if (inObserver) {
        let selector = selectorComparison(node as ts.Expression, ctx.checker);

        if (selector !== null) {
            // SIG/KEY are rewritten recursively so nested templates/reactive calls inside them
            // still lower; the replacement spans the whole comparison, so returning here keeps
            // its offsets from overlapping any child replacement under the descending-start sort
            replacements.push({
                end: node.end,
                start: node.getStart(ctx.sourceFile),
                text: `${selector.negated ? '!' : ''}${SIGNAL}.selector(${rewriteExpression(ctx, selector.node)}, ${rewriteExpression(ctx, selector.key)})`
            });
            ctx.selectorFired = true;

            return;
        }
    }

    let childObserver = inObserver || ts.isArrowFunction(node) || ts.isFunctionExpression(node);

    node.forEachChild(child => collectNestedReplacements(ctx, child, replacements, childObserver));
}

function generateAttributeBinding(element: string, name: string, expr: string): string {
    if (name.startsWith('on') && name.length > 2) {
        let key = name.toLowerCase();

        if (LIFECYCLE_EVENTS.has(key)) {
            return `${NAMESPACE}.${key}(${element}, ${expr});`;
        }

        // Same character gates as runtime() in ../event: types reject DOM events starting with
        // 'ce', 'doc' or 'wi', so a match can only be a prefix
        let i = 2,
            once = false;

        if (key[2] === 'c' && key[3] === 'e') {
            i = 4;
            once = true;
        }

        let flag = once ? ', true' : '';

        if (key[i] === 'd' && key[i + 1] === 'o' && key[i + 2] === 'c') {
            return `${NAMESPACE}.ondocument(${element}, '${key.slice(i + 8)}', ${expr}${flag});`;
        }

        if (key[i] === 'w' && key[i + 1] === 'i') {
            return `${NAMESPACE}.onwindow(${element}, '${key.slice(i + 6)}', ${expr}${flag});`;
        }

        let event = key.slice(i);

        if (DIRECT_ATTACH_EVENTS.has('on' + event)) {
            return `${NAMESPACE}.on(${element}, '${event}', ${expr}${flag});`;
        }

        return `${NAMESPACE}.delegate(${element}, '${event}', ${expr}${flag});`;
    }

    if (name === 'class' || name === 'style') {
        // Static class/style tokens ride the template clone; setList seeds them from the
        // element's own attribute, so no compile-time static map is threaded here
        return `${NAMESPACE}.setList(${element}, '${name}', ${expr});`;
    }

    return `${NAMESPACE}.setProperty(${element}, '${name}', ${expr});`;
}

function generateNestedTemplateCode(ctx: CodegenContext, node: ts.TaggedTemplateExpression): string {
    let parts = extractTemplateParts(node.template);

    if (!ctx.staticValues) {
        let variants = specialize(parts.expressions, ctx.checker, ctx.constants);

        if (variants.length) {
            let code = '(';

            ctx.parseCache ??= new Map();

            for (let i = 0, n = variants.length; i <= n; i++) {
                let variant = {
                        ...ctx,
                        expression: node,
                        prefoldCache: new WeakMap(),
                        staticValues: i < n ? variants[i].values : new Map()
                    },
                    branch = generateNestedTemplateCode(variant, node);

                ctx.selectorFired ||= variant.selectorFired;
                code += i < n ? `${variants[i].condition} ? ${branch} : ` : branch;
            }

            return code + ')';
        }
    }

    let { expressions, literals } = prefoldCached(ctx, node, parts.literals, parts.expressions);

    return generateTemplateCode(ctx, parseCached(ctx, literals), expressions, node);
}

function generateNodeBinding(ctx: CodegenContext, anchor: string, expr: ts.Expression | undefined, text: () => string, mode: 'last' | 'sole' | undefined): string {
    let flag = mode ? ', ' + (mode === 'sole' ? ANCHOR_SOLE : ANCHOR_LAST) : '',
        node: string;

    switch (expr ? analyze(expr, ctx.sites, ctx.checker) : TYPES.Unknown) {
        case TYPES.ArraySlot:
        case TYPES.VirtualSlot: {
            let call = expr!;

            while (ts.isParenthesizedExpression(call)) {
                call = call.expression;
            }

            let entrypoint = entrypointOf(call, ctx.sites);

            // A sole-child ArraySlot owns the parent's entire content, so the runtime may bulk-clear
            // via parent.textContent; a last-child slot has preceding siblings, so the flag stays off.
            // A conditional between slots is already lowered to instances by rewriteExpression.
            node = entrypoint
                ? `${generateSlotCode(ctx, call as ts.CallExpression, entrypoint, mode === 'sole')}.fragment`
                : `(${text()}).fragment`;
            break;
        }

        case TYPES.DocumentFragment:
            node = text();
            break;

        case TYPES.Effect:
            return `new ${NAMESPACE}.EffectSlot(${anchor}, ${text()}${flag});`;

        case TYPES.Primitive:
        case TYPES.Static:
            if (!mode) {
                return `${anchor}.after(${NAMESPACE}.text(${text()}));`;
            }

            node = `${NAMESPACE}.text(${text()})`;
            break;

        default:
            return `${NAMESPACE}.slot(${anchor}, ${text()}${flag});`;
    }

    return mode
        ? `${anchor}.appendChild(${node});`
        : `${anchor}.parentNode!.insertBefore(${node}, ${anchor});`;
}

function generateSlotCode(ctx: CodegenContext, call: ts.CallExpression, entrypoint: Entrypoint, soleChild: boolean): string {
    let args = call.arguments,
        virtual = entrypoint === ENTRYPOINT_VIRTUAL;

    if (args.length !== 2 && !(virtual && args.length === 3)) {
        throw new Error(`${PACKAGE_NAME}: html.${entrypoint}() expects ${virtual ? '2 or 3' : '2'} arguments, received ${args.length}`);
    }

    let code = `new ${NAMESPACE}.${virtual ? 'VirtualSlot' : 'ArraySlot'}(${rewriteExpression(ctx, args[0])}, ${rewriteExpression(ctx, args[1])}`;

    if (args.length === 3) {
        code += ', ' + rewriteExpression(ctx, args[2]);
    }
    else if (soleChild && !virtual) {
        code += ', true';
    }

    return code + ')';
}

function generateTemplateCode(ctx: CodegenContext, { html, slots }: ParseResult, expressions: ts.Expression[], templateNode: ts.Node): string {
    if (!slots || slots.length === 0) {
        return `${getTemplateID(ctx, html)}()`;
    }

    let code: string[] = [],
        declarations: string[] = [],
        elements = new Map<string, string>(),
        index = 0,
        isArrowBody = ctx.expression !== templateNode && isArrowExpressionBody(templateNode),
        keys: string[] = [],
        root = uid('root'),
        texts: string[] = [];

    // Rewritten lazily: bindings that consume the expression node directly (spread expansion,
    // slot construction) never pay for a rewrite they would discard
    let text = (i: number) => texts[i] ??= (expressions[i] ? rewriteExpression(ctx, expressions[i]) : 'undefined');

    declarations.push(`${root} = ${getTemplateID(ctx, html)}()`);
    elements.set('', root);

    for (let i = 0, n = slots.length; i < n; i++) {
        let path = slots[i].path,
            key = keys[i] = path.join('.');

        if (elements.has(key)) {
            continue;
        }

        let ancestor = root,
            start = 0;

        for (let j = path.length - 1; j >= 0; j--) {
            let prefix = elements.get(path.slice(0, j).join('.'));

            if (prefix) {
                ancestor = prefix;
                start = j;
                break;
            }
        }

        let name = uid('element'),
            value = ancestor;

        for (let j = start, m = path.length; j < m; j++) {
            value += `.${path[j]}`;

            if (j < m - 1) {
                value = `(${value}! as ${NAMESPACE}.Element)`;
            }
        }

        declarations.push(`${name} = ${value} as ${NAMESPACE}.Element`);
        elements.set(key, name);
    }

    code.push(isArrowBody ? '{' : `(() => {`, `let ${declarations.join(',\n')};`);

    for (let i = 0, n = slots.length; i < n; i++) {
        let element = elements.get(keys[i])!,
            slot = slots[i];

        if (slot.type !== TYPES.Attribute) {
            code.push(generateNodeBinding(ctx, element, expressions[index], text.bind(null, index), slot.mode));
            index++;
            continue;
        }

        let names = slot.attributes.names,
            parts = slot.attributes.parts;

        for (let j = 0, m = names.length; j < m; j++) {
            let name = names[j];

            if (name === TYPES.Attributes) {
                let expr = expressions[index];

                if (expr && isExpandable(expr)) {
                    for (let k = 0, p = expr.properties.length; k < p; k++) {
                        let prop = expr.properties[k] as ts.PropertyAssignment | ts.ShorthandPropertyAssignment,
                            key = (prop.name as ts.Identifier | ts.StringLiteral).text;

                        code.push(
                            generateAttributeBinding(element, key, ts.isPropertyAssignment(prop) ? rewriteExpression(ctx, prop.initializer) : key)
                        );
                    }
                }
                else {
                    code.push(`${NAMESPACE}.setProperties(${element}, ${text(index)});`);
                }

                index++;
            }
            else if (name.startsWith('on') && name.length > 2) {
                code.push(generateAttributeBinding(element, name, text(index++)));
            }
            else {
                // Markers sharing a value (or a class/style token) with each other or with
                // literal text emit ONE binding. Resolve callback parts reactively,
                // preserving independent bindings for separate class/style groups.
                let group = parts[j].group,
                    last = j;

                while (last + 1 < m && names[last + 1] === name && parts[last + 1].group === group) {
                    last++;
                }

                if (last === j && !parts[j].prefix && !parts[j].suffix) {
                    code.push(generateAttributeBinding(element, name, text(index++)));
                    continue;
                }

                let values: string[] = [];

                for (let k = j; k <= last; k++) {
                    if (parts[k].prefix) {
                        values.push(JSON.stringify(parts[k].prefix));
                    }

                    values.push(`(${text(index++)})`);
                }

                if (parts[last].suffix) {
                    values.push(JSON.stringify(parts[last].suffix));
                }

                code.push(generateAttributeBinding(element, name, `${NAMESPACE}.interpolate([${values.join(', ')}])`));
                j = last;
            }
        }
    }

    code.push(`return ${root};`, isArrowBody ? `}` : `})()`);

    return code.join('\n');
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

// A spread object literal expands into per-property bindings only when every member is a
// plain `name: value` / shorthand whose key is statically known; anything else (spreads,
// computed or numeric keys, accessors) keeps runtime setProperties semantics
function isExpandable(expr: ts.Expression): expr is ts.ObjectLiteralExpression {
    if (!ts.isObjectLiteralExpression(expr)) {
        return false;
    }

    let expandable = true;

    for (let i = 0, n = expr.properties.length; i < n; i++) {
        let prop = expr.properties[i];

        if (ts.isMethodDeclaration(prop)) {
            throw new Error(`${PACKAGE_NAME}: method declarations are not supported in spread attribute object literals`);
        }

        if (ts.isPropertyAssignment(prop)) {
            expandable &&= ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name);
        }
        else {
            expandable &&= ts.isShorthandPropertyAssignment(prop) && !prop.objectAssignmentInitializer;
        }
    }

    return expandable;
}

// True when an expression supplies an attribute's entire value (`name=${x}`, `name="${x}"`).
// Text that merely looks like `a =${x} b` also matches; callers only use this to decline a fold.
function isWholeAttributeValue(before: string, after: string): boolean {
    let open = REGEX_ATTRIBUTE_VALUE_OPEN.exec(before);

    if (!open) {
        return false;
    }

    return open[1] ? after.startsWith(open[1]) : REGEX_UNQUOTED_VALUE_CLOSE.test(after);
}

// Each distinct template is parsed once per transform. The key joins the (post-prefold)
// literals on NUL, which source template text cannot contain.
function parseCached(ctx: CodegenContext, literals: string[]): ParseResult {
    let cache = ctx.parseCache ??= new Map<string, ParseResult>(),
        key = literals.join('\0'),
        result = cache.get(key);

    if (result === undefined) {
        result = parser.parse(literals) as ParseResult;
        cache.set(key, result);
    }

    return result;
}

// Merge every foldable expression into the surrounding literals BEFORE parse: the folded value
// rides the template clone (as text or a static attribute token) instead of a runtime binding.
// This is the only safe splice point — post-parse HTML rewriting would invalidate the
// sibling-count-derived node paths of later slots.
function prefold(ctx: CodegenContext, literals: string[], expressions: ts.Expression[]): Prefolded {
    if (expressions.length === 0) {
        return { expressions, literals };
    }

    let foldedExpressions: ts.Expression[] = [],
        foldedLiterals: string[] = [literals[0]];

    for (let i = 0, n = expressions.length; i < n; i++) {
        let folded = ctx.staticValues?.get(expressions[i]) ?? fold(expressions[i], ctx.checker, ctx.constants);

        // A whole attribute value binds through the element's property when one exists, where
        // '' and 0 coerce to false (`disabled`, `hidden`); a static `disabled=""` would set it.
        // Only the runtime knows which names are property-backed, so falsy values stay bindings.
        if (
            (folded === '' || folded === '0') &&
            isWholeAttributeValue(foldedLiterals[foldedLiterals.length - 1], literals[i + 1])
        ) {
            folded = null;
        }

        if (folded === null) {
            foldedExpressions.push(expressions[i]);
            foldedLiterals.push(literals[i + 1]);
        }
        else {
            foldedLiterals[foldedLiterals.length - 1] += folded + literals[i + 1];
        }
    }

    return { expressions: foldedExpressions, literals: foldedLiterals };
}

// prefold's inputs derive entirely from the template node, so its result is stable per node
function prefoldCached(ctx: CodegenContext, node: ts.Node, literals: string[], expressions: ts.Expression[]): Prefolded {
    let cache = ctx.prefoldCache ??= new WeakMap<ts.Node, Prefolded>(),
        result = cache.get(node);

    if (result === undefined) {
        result = prefold(ctx, literals, expressions);
        cache.set(node, result);
    }

    return result;
}


// Top-level reactive calls lower first, then root templates. A call nested in a template or
// in an already-lowered call, and a template nested in either, is emitted by its enclosing
// rewrite — emitting it separately would produce overlapping replacements.
const generateCode = ({ calls, constants, sites, templates }: Artifacts, sourceFile: ts.SourceFile, checker?: ts.Checker): CodegenResult => {
    let ctx: CodegenContext = {
            checker: checker && cached(checker),
            constants,
            parseCache: new Map(),
            sites,
            sourceFile,
            templates: new Map()
        },
        nested: Range[] = [],
        prepend: string[] = [],
        replacements: ReplacementIntent[] = [],
        templateRanges: Range[] = [];

    for (let i = 0, n = templates.length; i < n; i++) {
        let { end, expressions, start } = templates[i];

        templateRanges.push({ end, start });

        for (let j = 0, m = expressions.length; j < m; j++) {
            nested.push({ end: expressions[j].end, start: expressions[j].getStart(sourceFile) });
        }
    }

    for (let i = 0, n = calls.length; i < n; i++) {
        let { end, entrypoint, node, start } = calls[i];

        if (ast.inRange(templateRanges, start, end) || ast.inRange(nested, start, end)) {
            continue;
        }

        let code = generateSlotCode(ctx, node, entrypoint, false);

        nested.push({ end, start });
        replacements.push({ generate: () => code, node });
    }

    for (let i = 0, n = templates.length; i < n; i++) {
        let { end, node, start } = templates[i];

        if (ast.inRange(nested, start, end)) {
            continue;
        }

        let code = generateNestedTemplateCode(ctx, node);

        replacements.push({ generate: () => code, node });
    }

    for (let [html, id] of ctx.templates) {
        prepend.push(`const ${id} = ${NAMESPACE}.template(\`${html}\`);`);
    }

    return { prepend, replacements, selectorFired: ctx.selectorFired === true, templates: ctx.templates };
};

const rewriteExpression = (ctx: CodegenContext, expr: ts.Expression): string => {
    if (isHtmlTemplate(expr, ctx.sites)) {
        return generateNestedTemplateCode(ctx, expr);
    }

    let entrypoint = entrypointOf(expr, ctx.sites);

    if (entrypoint) {
        return generateSlotCode(ctx, expr as ts.CallExpression, entrypoint, false);
    }

    let replacements: (Range & { text: string })[] = [],
        rootObserver = ts.isArrowFunction(expr) || ts.isFunctionExpression(expr);

    expr.forEachChild(child => collectNestedReplacements(ctx, child, replacements, rootObserver));

    if (replacements.length === 0) {
        return expr.getText(ctx.sourceFile);
    }

    let start = expr.getStart(ctx.sourceFile),
        text = expr.getText(ctx.sourceFile);

    replacements.sort((a, b) => b.start - a.start);

    for (let i = 0, n = replacements.length; i < n; i++) {
        let r = replacements[i];

        text = text.slice(0, r.start - start) + r.text + text.slice(r.end - start);
    }

    return text;
};


export { generateCode, rewriteExpression };
export type { CodegenContext, CodegenResult };
