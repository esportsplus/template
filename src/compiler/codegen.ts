import { ts } from '@esportsplus/typescript';
import { ast, checker as checkers, uid } from '@esportsplus/typescript/compiler';
import type { Prepend, ReplacementIntent, Text } from '@esportsplus/typescript/compiler';
import { ANCHOR_SOLE } from '../constants';
import parse from '../event/parse';
import { ENTRYPOINT_VIRTUAL, NAMESPACE, PACKAGE_NAME, PART, SIGNAL, TYPES } from './constants';
import type { Entrypoint } from './constants';
import { analyze, fold, measure, partOf, readCalls, selectorComparison } from './ts-analyzer';
import { entrypointOf, extractTemplateParts, isHtmlTemplate } from './ts-parser';
import type { Artifacts } from './ts-parser';
import parser from './parser';
import { specialize } from './specialize';


type CodegenContext = {
    // Whether each spread is an attributes object, by attributesObjects() (see prefetch())
    attributes?: Map<ts.Expression, boolean>;
    constants?: Set<string>;
    // What each token in generated code stands for; see resolve()
    deferred?: Deferred[];
    // Root of a specialized variant: it must lower to an expression, never an arrow block body
    expression?: ts.Node;
    // What each template expression folds to, by fold() (see prefetch())
    folds?: Map<ts.Expression, string | null>;
    // Module-level constants by their code with source copied as it was written (see hoist()), shared by every variant
    hoisted?: Map<string, { code: string; id: string }>;
    // Target nodes of the rewrites in `nested`
    markers?: Set<ts.Node>;
    // One intent per rewrite nested in copied source, generating its marker; see mark()
    nested?: ReplacementIntent[];
    // What each expression is, by measure() (see prefetch())
    parts?: Map<ts.Expression, PART>;
    prefoldCache?: WeakMap<ts.Node, Prefolded>;
    // The file's read() calls that are @esportsplus/reactivity's, by readCalls() (see prefetch()); without a checker,
    // every read() call is taken at its name
    reads?: Set<ts.Node>;
    // Event handlers that close over nothing of the instance, by isModuleScoped() (see prefetch())
    scoped?: Set<ts.Expression>;
    selectorFired?: boolean;
    // Template html whose clone is its one root element (see parser's single())
    singles: Set<string>;
    sourceFile: ts.SourceFile;
    // Expressions denoting `html` (see Artifacts.sites)
    sites: Set<ts.Node>;
    staticValues?: Map<ts.Expression, string>;
    templates: Map<string, string>;
    // Each template's specialized variants, by specialize() (see prefetch())
    variants?: Map<ts.Node, Variant[]>;
};

type CodegenResult = {
    // Intents of the rewrites nested in copied source, returned beside `replacements` for the coordinator to compose
    nested: ReplacementIntent[];
    prepend: Prepend[];
    replacements: ReplacementIntent[];
    selectorFired: boolean;
    templates: Map<string, string>;
};

// A node whose source is copied into generated code: its composed text (see resolve()), with the code of each rewrite
// nested in it, or the value a shorthand property reads
type Deferred = { nested: Nested[]; node: ts.Node; shorthand: boolean };

type Nested = { code: string; node: ts.Node };

type ParseResult = ReturnType<typeof parser.parse>;

type Prefolded = { expressions: ts.Expression[]; literals: string[] };

type Range = { end: number; start: number };

type Variant = Awaited<ReturnType<typeof specialize>>[number];


// Neither occurs in source text: a marker is what the coordinator's composed text holds where a nested rewrite goes,
// a token what generated code holds where composed source goes
const MARKER = '\u0000M';

const PARSED = new Map<string, ParseResult>();

const PARSED_LIMIT = 2000;

const REGEX_ATTRIBUTE_VALUE_OPEN = /=\s*(["']?)$/;

// oxlint-disable-next-line no-control-regex -- NUL delimits markers precisely because source never holds one
const REGEX_MARKER = /\u0000M(\d+)\u0000/g;

const REGEX_TEMPLATE_SYNTAX = /[\\`\r]|\$\{/g;

// oxlint-disable-next-line no-control-regex -- NUL delimits tokens precisely because source never holds one
const REGEX_TOKEN = /\u0000T(\d+)\u0000/g;

const REGEX_UNQUOTED_VALUE_CLOSE = /^(?:[\s>]|\/>)/;

const TOKEN = '\u0000T';


// Whether each spread is typed as an object that is never an array and declares both class and style, as Attributes
// does: `value?.class` and `value?.style` are then sound to read, so they join the element's merged list calls. Each
// step asks about every spread's member types in one request.
async function attributesObjects(checker: ts.Checker, exprs: ts.Expression[]): Promise<Map<ts.Expression, boolean>> {
    let members: (ts.Type[] | null)[] = [],
        objects = new Map<number, ts.Type>(),
        result = new Map<ts.Expression, boolean>();

    if (exprs.length === 0) {
        return result;
    }

    let types = await checker.getTypeAtLocation(exprs) as (ts.Type | undefined)[],
        unions = await Promise.all(types.map(async type => type?.isUnionType() ? type.getTypes() : undefined));

    for (let i = 0, n = exprs.length; i < n; i++) {
        let type = types[i],
            list: ts.Type[] | null = [];

        if (!type) {
            members.push(null);
            continue;
        }

        let all = unions[i] ?? [type];

        for (let j = 0, m = all.length; j < m; j++) {
            let member = all[j];

            if (member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) {
                continue;
            }

            if ((member.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) === 0) {
                list = null;
                break;
            }

            list.push(member);
        }

        if (list !== null) {
            for (let j = 0, m = list.length; j < m; j++) {
                objects.set(list[j].id, list[j]);
            }
        }

        members.push(list);
    }

    let candidates = [...objects.values()],
        declares = new Map<number, boolean>();

    if (candidates.length > 0) {
        let arrays = await Promise.all(candidates.map(type => checker.isArrayLikeType(type))),
            plain = candidates.filter((_, i) => !arrays[i]),
            properties: [ts.Type, string][] = [];

        for (let i = 0, n = plain.length; i < n; i++) {
            properties.push([plain[i], 'class'], [plain[i], 'style']);
        }

        let found = await Promise.all(properties.map(([type, name]) => checker.getPropertyOfType(type, name)));

        for (let i = 0, n = plain.length; i < n; i++) {
            declares.set(plain[i].id, !!found[2 * i] && !!found[2 * i + 1]);
        }
    }

    for (let i = 0, n = exprs.length; i < n; i++) {
        let list = members[i];

        result.set(exprs[i], list !== null && list.length > 0 && list.every(member => declares.get(member.id) === true));
    }

    return result;
}

// What a composed value's part is (see PART); a string or number joins as it is, with nothing to drop or call
function classify(ctx: CodegenContext, expr: ts.Expression | undefined): PART {
    if (expr === undefined) {
        return PART.Value;
    }

    while (ts.isParenthesizedExpression(expr)) {
        expr = expr.expression;
    }

    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        return PART.Function;
    }

    if (isLiteral(expr) || ts.isTemplateExpression(expr)) {
        return PART.Text;
    }

    return partOf(expr, ctx.parts);
}

function collectNestedReplacements(ctx: CodegenContext, node: ts.Node, replacements: Nested[], inObserver: boolean): void {
    if (isHtmlTemplate(node, ctx.sites)) {
        let code = generateNestedTemplateCode(ctx, node);

        replacements.push(mark(ctx, replaced(node, code), code));

        return;
    }

    let entrypoint = entrypointOf(node, ctx.sites);

    if (entrypoint) {
        // Slots nested in arbitrary expressions have no provable parent element,
        // so they never receive the sole-child flag
        replacements.push(mark(ctx, node, generateSlotCode(ctx, node as ts.CallExpression, entrypoint, false)));

        return;
    }

    if (inObserver) {
        let selector = selectorComparison(node as ts.Expression, ctx.reads);

        if (selector !== null) {
            // SIG/KEY are rewritten recursively so nested templates/reactive calls inside them still lower; the
            // rewrite spans the whole comparison, so returning here keeps any child rewrite inside it
            replacements.push(mark(
                ctx,
                node,
                `${selector.negated ? '!' : ''}${SIGNAL}.selector(${rewriteExpression(ctx, selector.node)}, ${rewriteExpression(ctx, selector.key)})`
            ));
            ctx.selectorFired = true;

            return;
        }
    }

    let childObserver = inObserver || ts.isArrowFunction(node) || ts.isFunctionExpression(node);

    node.forEachChild(child => collectNestedReplacements(ctx, child, replacements, childObserver));
}

// Declares the element at the first 'length' steps of 'path', walking from its deepest declared ancestor
function declareElement(declarations: string[], elements: Map<string, string>, path: string[], length: number): void {
    let key = path.slice(0, length).join('.');

    if (elements.has(key)) {
        return;
    }

    let start = 0,
        value = elements.get('')!;

    for (let j = length - 1; j > 0; j--) {
        let prefix = elements.get(path.slice(0, j).join('.'));

        if (prefix) {
            start = j;
            value = prefix;
            break;
        }
    }

    for (let j = start; j < length; j++) {
        value += `.${path[j]}`;

        if (j < length - 1) {
            value = `(${value}! as ${NAMESPACE}.Element)`;
        }
    }

    let name = uid('element');

    declarations.push(`${name} = ${value} as ${NAMESPACE}.Element`);
    elements.set(key, name);
}

// A token standing for the node's source as it is composed when the output is generated (see resolve())
function defer(ctx: CodegenContext, node: ts.Node, nested: Nested[], shorthand: boolean = false): string {
    let deferred = ctx.deferred ??= [];

    deferred.push({ nested, node, shorthand });

    return TOKEN + (deferred.length - 1) + '\u0000';
}

// The deferred node's composed text with each nested rewrite's code in place of its marker. Text holding no marker
// is the node's own source (a caller composing nothing, as a single-plugin harness does), so the rewrites splice in
// at their source offsets. Any other text lost a nested rewrite to an enclosing replacement that did not copy it.
function expand(ctx: CodegenContext, { nested, node, shorthand }: Deferred, text: Text): string {
    let composed = text(node);

    if (shorthand) {
        let key = ((node as ts.ShorthandPropertyAssignment).name as ts.Identifier).text;

        if (composed === key) {
            return key;
        }

        // Another plugin rewrote the shorthand into `key: value`; the binding takes the value
        let colon = composed.indexOf(':');

        if (colon === -1 || composed.slice(0, colon).trim() !== key) {
            throw new Error(`${PACKAGE_NAME}: shorthand property '${key}' was rewritten to '${composed}', which is not a '${key}: value' property`);
        }

        return composed.slice(colon + 1).trim();
    }

    if (nested.length === 0) {
        return composed;
    }

    let found = new Set<Nested>();

    composed = composed.replace(REGEX_MARKER, (_, index: string) => {
        let target = ctx.nested![Number(index)].node;

        for (let i = 0, n = nested.length; i < n; i++) {
            if (nested[i].node === target) {
                found.add(nested[i]);

                return resolve(ctx, nested[i].code, text);
            }
        }

        throw new Error(`${PACKAGE_NAME}: ${location(ctx, target)} nested rewrite surfaced outside the expression it belongs to`);
    });

    if (found.size === nested.length) {
        return composed;
    }

    if (found.size > 0 || composed !== node.getText(ctx.sourceFile)) {
        throw new Error(`${PACKAGE_NAME}: ${location(ctx, node)} a replacement around compiled template code dropped it`);
    }

    let ordered = [...nested].sort((a, b) => b.node.getStart(ctx.sourceFile) - a.node.getStart(ctx.sourceFile)),
        start = node.getStart(ctx.sourceFile);

    for (let i = 0, n = ordered.length; i < n; i++) {
        let { code, node: target } = ordered[i];

        composed = composed.slice(0, target.getStart(ctx.sourceFile) - start) + resolve(ctx, code, text) + composed.slice(target.end - start);
    }

    return composed;
}

function generateAttributeBinding(ctx: CodegenContext, element: string, name: string, expr: string): string {
    if (name.startsWith('on')) {
        let key = parse(name as `on${string}`);

        if (key.event === null) {
            return `${NAMESPACE}.${key.route}(${element}, ${expr});`;
        }

        return `${NAMESPACE}.${key.route}(${element}, '${key.event}', ${expr}${key.once ? ', ' + hoist(ctx, '{ once: true }') : ''});`;
    }

    return `${NAMESPACE}.setProperty(${element}, '${name}', ${expr});`;
}

// A value composed of literal text and expressions, joined by concatenation. Each expression is evaluated once, where
// the binding is created; one that is (or may be) a function makes the value a function of the element, which calls it
// on every run. A part drops null, undefined and false; a proven string or number joins as it is.
function generateComposedValue(ctx: CodegenContext, code: string[], segments: (string | { expr: ts.Expression | undefined; text: string })[]): string {
    let declarations: string[] = [],
        dynamic = false,
        element = '',
        kinds: PART[] = [],
        pieces: string[] = [],
        strip = '';

    for (let i = 0, n = segments.length; i < n; i++) {
        let segment = segments[i];

        kinds[i] = typeof segment === 'string' ? PART.Text : classify(ctx, segment.expr);
        dynamic ||= kinds[i] === PART.Function || kinds[i] === PART.Unknown;
    }

    if (dynamic) {
        element = uid('element');
    }

    for (let i = 0, n = segments.length; i < n; i++) {
        let kind = kinds[i],
            segment = segments[i];

        if (typeof segment === 'string') {
            pieces.push(JSON.stringify(segment));
            continue;
        }

        if (kind !== PART.Text) {
            strip ||= hoist(ctx, `(value: unknown) => value == null || value === false ? '' : value`, 'part');
        }

        // A static value is joined once where the binding is created: nothing to hold
        if (!dynamic || (kind === PART.Text && segment.expr !== undefined && isLiteral(segment.expr))) {
            pieces.push(kind === PART.Text ? `(${segment.text})` : `${strip}(${segment.text})`);
            continue;
        }

        let id = uid('value');

        // A function part may declare no parameter, or a narrower element than the binding passes
        if (kind === PART.Function) {
            declarations.push(`${id}: Function = ${segment.text}`);
            pieces.push(`${strip}(${id}(${element}))`);
        }
        else if (kind === PART.Unknown) {
            declarations.push(`${id}: any = ${segment.text}`);
            pieces.push(`${strip}(typeof ${id} === 'function' ? ${id}(${element}) : ${id})`);
        }
        else {
            declarations.push(kind === PART.Text ? `${id} = ${segment.text}` : `${id} = ${strip}(${segment.text})`);
            pieces.push(id);
        }
    }

    if (declarations.length) {
        code.push(`let ${declarations.join(', ')};`);
    }

    // The leading string keeps two numbers from adding
    let joined = (pieces[0][0] === '"' ? '' : '"" + ') + pieces.join(' + ');

    return dynamic ? `(${element}: ${NAMESPACE}.Element) => ${joined}` : joined;
}

function generateNestedTemplateCode(ctx: CodegenContext, node: ts.TaggedTemplateExpression): string {
    let parts = extractTemplateParts(node.template);

    if (!ctx.staticValues) {
        let variants = ctx.variants?.get(node) ?? [];

        if (variants.length) {
            let code = '(';

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

    return generateTemplateCode(ctx, parseCached(literals), expressions, node);
}

function generateNodeBinding(ctx: CodegenContext, anchor: string, expr: ts.Expression | undefined, text: () => string, mode: 'last' | 'sole' | undefined): string {
    let flag = mode ? ', ' + ANCHOR_SOLE : '',
        node: string;

    switch (expr ? analyze(expr, ctx.sites, ctx.parts) : TYPES.Unknown) {
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

function generateTemplateCode(ctx: CodegenContext, { html, single, slots }: ParseResult, expressions: ts.Expression[], templateNode: ts.Node): string {
    if (!slots || slots.length === 0) {
        return `${getTemplateID(ctx, html, single)}()`;
    }

    // A template that is an arrow's body or a return's expression lowers to statements, not to a called closure
    let block = ctx.expression !== templateNode && (isArrowExpressionBody(templateNode) || isReturned(templateNode)),
        code: string[] = [],
        declarations: string[] = [],
        elements = new Map<string, string>(),
        index = 0,
        keys: string[] = [],
        offsets: number[] = [],
        // A single-root template clones its root element, so every path starts below the root's own first step
        paths = slots.map(slot => single ? slot.path.slice(1) : slot.path),
        root = uid('root'),
        texts: string[] = [];

    // Rewritten lazily: bindings that consume the expression node directly (spread expansion,
    // slot construction) never pay for a rewrite they would discard
    let text = (i: number) => texts[i] ??= (expressions[i] ? rewriteExpression(ctx, expressions[i]) : 'undefined');

    declarations.push(`${root} = ${getTemplateID(ctx, html, single)}()${single ? ` as ${NAMESPACE}.Element` : ''}`);
    elements.set('', root);

    // Where two or more slot paths part, the ancestor they share is declared once, so none of them walks it again
    let branches = new Map<string, Set<string>>();

    for (let i = 0, n = slots.length; i < n; i++) {
        let path = paths[i];

        for (let j = 1, m = path.length; j < m; j++) {
            let prefix = path.slice(0, j).join('.'),
                next = branches.get(prefix);

            if (!next) {
                next = new Set();
                branches.set(prefix, next);
            }

            next.add(path[j]);
        }
    }

    for (let i = 0, n = slots.length; i < n; i++) {
        let path = paths[i],
            slot = slots[i];

        keys[i] = path.join('.');
        offsets[i] = index;
        index += slot.type === TYPES.Attribute ? slot.attributes.names.length : 1;

        for (let j = 1, m = path.length; j < m; j++) {
            if (branches.get(path.slice(0, j).join('.'))!.size > 1) {
                declareElement(declarations, elements, path, j);
            }
        }

        declareElement(declarations, elements, path, path.length);
    }

    code.push(block ? '{' : `(() => {`, `let ${declarations.join(',\n')};`);

    for (let i = 0, n = slots.length; i < n; i++) {
        let slot = slots[i];

        if (slot.type !== TYPES.Attribute) {
            code.push(generateNodeBinding(ctx, elements.get(keys[i])!, expressions[offsets[i]], text.bind(null, offsets[i]), slot.mode));
        }
    }

    // Nested templates first, then attributes in reverse document order: lifecycle hooks register (and so run)
    // descendants before ancestors, so a parent's onconnect sees the refs its children took.
    for (let i = slots.length - 1; i >= 0; i--) {
        let slot = slots[i];

        if (slot.type !== TYPES.Attribute) {
            continue;
        }

        let element = elements.get(keys[i])!,
            index = offsets[i],
            lists: Record<string, string[]> = { class: [], style: [] },
            names = slot.attributes.names,
            parts = slot.attributes.parts,
            spread = false;

        for (let j = 0, m = names.length; j < m; j++) {
            let name = names[j];

            if (name === TYPES.Attributes) {
                let expr = expressions[index];

                spread = true;

                if (expr && isExpandable(expr)) {
                    for (let k = 0, p = expr.properties.length; k < p; k++) {
                        let prop = expr.properties[k] as ts.PropertyAssignment | ts.ShorthandPropertyAssignment,
                            key = (prop.name as ts.Identifier | ts.StringLiteral).text,
                            value = ts.isPropertyAssignment(prop) ? rewriteExpression(ctx, prop.initializer) : defer(ctx, prop, [], true);

                        if (key === 'class' || key === 'style') {
                            lists[key].push(value);
                        }
                        else {
                            code.push(generateAttributeBinding(ctx, element, key, value));
                        }
                    }
                }
                else if (expr && ctx.attributes?.get(expr) === true) {
                    let id = uid('attributes');

                    code.push(`let ${id} = ${text(index)};`, `${NAMESPACE}.setProperties(${element}, ${id}, true);`);
                    lists.class.push(`${id}?.class`);
                    lists.style.push(`${id}?.style`);
                }
                else {
                    code.push(`${NAMESPACE}.setProperties(${element}, ${text(index)});`);
                }

                index++;
            }
            else if (name.startsWith('on')) {
                let expr = expressions[index],
                    handler = text(index++);

                // A handler that closes over nothing of the instance is one closure per module, not one per instance
                if (expr && ctx.scoped?.has(expr)) {
                    handler = hoist(ctx, handler, 'handler');
                }

                code.push(generateAttributeBinding(ctx, element, name, handler));
            }
            else {
                // Markers sharing a value (or a class/style token) with each other or with
                // literal text emit ONE binding. Resolve callback parts reactively,
                // preserving independent bindings for separate class/style groups.
                let group = parts[j].group,
                    last = j,
                    value: string;

                while (last + 1 < m && names[last + 1] === name && parts[last + 1].group === group) {
                    last++;
                }

                if (last === j && !parts[j].prefix && !parts[j].suffix) {
                    value = text(index++);
                }
                else {
                    let segments: (string | { expr: ts.Expression | undefined; text: string })[] = [];

                    for (let k = j; k <= last; k++) {
                        if (parts[k].prefix) {
                            segments.push(parts[k].prefix);
                        }

                        segments.push({ expr: expressions[index], text: text(index++) });
                    }

                    if (parts[last].suffix) {
                        segments.push(parts[last].suffix);
                    }

                    value = generateComposedValue(ctx, code, segments);
                    j = last;
                }

                if (name === 'class' || name === 'style') {
                    lists[name].push(value);
                }
                else {
                    code.push(generateAttributeBinding(ctx, element, name, value));
                }
            }
        }

        // One call per list writes every part the element has, its static tokens first (see parser's metadata())
        for (let name of ['class', 'style']) {
            let statics = slot.attributes.static[name] ?? '';

            if (lists[name].length || (spread && statics)) {
                code.push(`${NAMESPACE}.${name === 'class' ? 'setClass' : 'setStyle'}(${element}, [${JSON.stringify(statics)}${lists[name].map(part => ', ' + part).join('')}]);`);
            }
        }
    }

    code.push(`return ${root};`, block ? `}` : `})()`);

    return code.join('\n');
}

function getTemplateID(ctx: CodegenContext, html: string, single: boolean): string {
    let id = ctx.templates.get(html);

    if (!id) {
        id = uid('template');
        ctx.templates.set(html, id);

        if (single) {
            ctx.singles.add(html);
        }
    }

    return id;
}

// Keyed by the code with source copied as written: two copies of the same module-scoped source compose alike, since
// every name in them resolves to the same module-level declaration
function hoist(ctx: CodegenContext, code: string, name: string = 'options'): string {
    let hoisted = ctx.hoisted ??= new Map(),
        key = resolve(ctx, code, written(ctx)),
        entry = hoisted.get(key);

    if (!entry) {
        entry = { code, id: uid(name) };
        hoisted.set(key, entry);
    }

    return entry.id;
}

function isArrowExpressionBody(node: ts.Node): boolean {
    return ts.isArrowFunction(node.parent) && (node.parent as ts.ArrowFunction).body === node;
}

function isReturned(node: ts.Node): boolean {
    return ts.isReturnStatement(node.parent) && node.parent.expression === node;
}

// What the lowered template replaces: its return statement when it lowered to a block (generated code only ever
// starts with a brace as one), else itself
function replaced(node: ts.Node, code: string): ts.Node {
    return code[0] === '{' && isReturned(node) ? node.parent : node;
}

// An arrow or function expression whose every free identifier, value or type, is declared by a statement at the top of
// a module (its own, through an import, or an ambient global): hoisted to module scope it means the same thing. What every
// identifier resolves to is asked first, in one request.
async function isModuleScoped(checker: ts.Checker, expr: ts.Expression): Promise<boolean> {
    while (ts.isParenthesizedExpression(expr)) {
        expr = expr.expression;
    }

    if (!ts.isArrowFunction(expr) && !ts.isFunctionExpression(expr)) {
        return false;
    }

    let fn: ts.Node = expr,
        identifiers: ts.Identifier[] = [],
        scoped = true,
        shorthands: ts.Identifier[] = [];

    let collect = (node: ts.Node): void => {
        if (isRead(node)) {
            (ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? shorthands : identifiers).push(node);
        }

        node.forEachChild(collect);
    };

    expr.forEachChild(collect);

    let [symbols, values] = await Promise.all([
            identifiers.length > 0 ? checker.getSymbolAtLocation(identifiers) : [],
            Promise.all(shorthands.map(node => checker.getShorthandAssignmentValueSymbol(node.parent as ts.ShorthandPropertyAssignment)))
        ]),
        declarations = new Map<ts.Node, ts.Node | undefined>(),
        resolved = await Promise.all([...symbols, ...values].map(async symbol => symbol?.declarations?.[0]?.resolve())),
        nodes = [...identifiers, ...shorthands];

    for (let i = 0, n = nodes.length; i < n; i++) {
        declarations.set(nodes[i], resolved[i]);
    }

    let visit = (node: ts.Node): void => {
        if (!scoped) {
            return;
        }

        if (
            node.kind === ts.SyntaxKind.ThisKeyword ||
            node.kind === ts.SyntaxKind.SuperKeyword ||
            ts.isMetaProperty(node) ||
            (ts.isIdentifier(node) && node.text === 'arguments')
        ) {
            scoped = false;
            return;
        }

        if (isRead(node)) {
            // A shorthand property's own symbol is the property, declared inside the handler; the value it reads is not
            let declaration = declarations.get(node);

            if (!declaration) {
                scoped = false;
                return;
            }

            let nested = false;

            for (let current: ts.Node | undefined = declaration.parent; current; current = current.parent) {
                // Declared by the handler itself: its own parameter or local
                if (current === fn) {
                    nested = false;
                    break;
                }

                if (ts.isSourceFile(current)) {
                    break;
                }

                // Declared inside a function, block or class body: it belongs to an instance, unless that scope is the
                // handler's own
                if (
                    ts.isBlock(current) ||
                    ts.isModuleBlock(current) ||
                    ts.isCaseBlock(current) ||
                    ts.isCatchClause(current) ||
                    ts.isClassDeclaration(current) ||
                    ts.isClassExpression(current) ||
                    ts.isForInStatement(current) ||
                    ts.isForOfStatement(current) ||
                    ts.isForStatement(current) ||
                    (current as { parameters?: unknown }).parameters !== undefined
                ) {
                    nested = true;
                }
            }

            if (nested) {
                scoped = false;
                return;
            }
        }

        node.forEachChild(visit);
    };

    expr.forEachChild(visit);

    return scoped;
}

function isLiteral(expr: ts.Expression): boolean {
    return ts.isStringLiteral(expr) || ts.isNumericLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr);
}

// An identifier read as a value: not a member, property or qualified name
function isRead(node: ts.Node): node is ts.Identifier {
    return ts.isIdentifier(node) &&
        !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
        !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) &&
        !(ts.isQualifiedName(node.parent) && node.parent.right === node);
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

// Template text is cooked: a template literal must escape what it would otherwise read as syntax, and a raw carriage
// return, which it would normalize to a line feed
function literal(text: string): string {
    return '`' + text.replace(REGEX_TEMPLATE_SYNTAX, match => match === '\r' ? '\\r' : '\\' + match) + '`';
}

function location(ctx: CodegenContext, node: ts.Node): string {
    let { character, line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart(ctx.sourceFile));

    return `${ctx.sourceFile.fileName}:${line + 1}:${character + 1}`;
}

// A rewrite nested in copied source is an intent of its own, so the coordinator composes it under whatever another
// plugin replaces around it; its intent generates a marker, and each copy of the enclosing source puts its own code
// for the rewrite in the marker's place (see expand())
function mark(ctx: CodegenContext, node: ts.Node, code: string): Nested {
    let markers = ctx.markers ??= new Set(),
        nested = ctx.nested ??= [];

    if (!markers.has(node)) {
        let marker = MARKER + nested.length + '\u0000';

        markers.add(node);
        nested.push({ generate: () => marker, node });
    }

    return { code, node };
}

// parse() is pure in its literals, so each distinct template is parsed once across transforms: a dev server's HMR
// transform re-parses only what changed. The key joins the (post-prefold) literals on NUL; text holding a NUL of its
// own could collide, so it skips the cache.
function parseCached(literals: string[]): ParseResult {
    let key = literals.join('\0'),
        result = PARSED.get(key);

    if (result !== undefined) {
        return result;
    }

    result = parser.parse(literals) as ParseResult;

    if (key.split('\0').length === literals.length) {
        if (PARSED.size >= PARSED_LIMIT) {
            PARSED.clear();
        }

        PARSED.set(key, result);
    }

    return result;
}

// Everything generateTemplateCode() asks of the checker for every template of the file, answered for all of them at once
// so the walk only reads answers: what each expression folds to, analyze() about a node slot, classify() about each part
// of a composed attribute value, whether a spread is an attributes object and an event handler module-scoped, each
// template's specialized variants and which read() calls are reactivity's. Every question starts in the same turn, so
// each round of them is one request. Folding only turns expressions into text, never moves one into another role, so
// the template's own parse tells each expression's role; a template that fails to parse has every expression asked
// about both ways.
async function prefetch(ctx: CodegenContext, templates: Artifacts['templates'], checker?: ts.Checker): Promise<void> {
    let expressions = templates.flatMap(template => template.expressions),
        folds = Promise.all(expressions.map(expr => fold(expr, checker, ctx.constants)));

    if (!checker) {
        ctx.folds = zip(expressions, await folds);

        return;
    }

    let handlers: ts.Expression[] = [],
        nodes: ts.Expression[] = [],
        sites = ctx.sites,
        spreads: ts.Expression[] = [];

    let node = (expr: ts.Expression): void => {
        while (ts.isParenthesizedExpression(expr)) {
            expr = expr.expression;
        }

        if (ts.isConditionalExpression(expr)) {
            node(expr.whenTrue);
            node(expr.whenFalse);
        }
        else if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr) || (ts.isCallExpression(expr) && entrypointOf(expr, sites) === null)) {
            nodes.push(expr);
        }
    };

    let part = (expr: ts.Expression): void => {
        while (ts.isParenthesizedExpression(expr)) {
            expr = expr.expression;
        }

        if (!ts.isArrowFunction(expr) && !ts.isFunctionExpression(expr) && !isLiteral(expr) && !ts.isTemplateExpression(expr)) {
            nodes.push(expr);
        }
    };

    for (let i = 0, n = templates.length; i < n; i++) {
        let { expressions, literals } = templates[i],
            slots: ParseResult['slots'];

        // Lowering parses the template again and reports what fails here
        try {
            slots = parseCached(literals).slots;
        }
        catch {
            for (let j = 0, m = expressions.length; j < m; j++) {
                node(expressions[j]);
                part(expressions[j]);
            }

            continue;
        }

        for (let j = 0, index = 0, m = slots?.length ?? 0; j < m; j++) {
            let slot = slots![j];

            if (slot.type !== TYPES.Attribute) {
                if (expressions[index]) {
                    node(expressions[index]);
                }

                index++;
                continue;
            }

            let names = slot.attributes.names,
                parts = slot.attributes.parts;

            for (let k = 0, p = names.length; k < p; k++) {
                let expr = expressions[index],
                    name = names[k];

                if (name === TYPES.Attributes) {
                    if (expr && !ts.isObjectLiteralExpression(expr)) {
                        spreads.push(expr);
                    }

                    index++;
                    continue;
                }

                if (name.startsWith('on')) {
                    if (expr) {
                        handlers.push(expr);
                    }

                    index++;
                    continue;
                }

                let last = k;

                while (last + 1 < p && names[last + 1] === name && parts[last + 1].group === parts[k].group) {
                    last++;
                }

                if (last === k && !parts[k].prefix && !parts[k].suffix) {
                    index++;
                    continue;
                }

                for (let q = k; q <= last; q++, index++) {
                    if (expressions[index]) {
                        part(expressions[index]);
                    }
                }

                k = last;
            }
        }
    }

    let immutables = new Map<ts.Symbol, Promise<boolean>>(),
        [attributes, folded, parts, reads, scoped, variants] = await Promise.all([
            attributesObjects(checker, spreads),
            folds,
            measure(checker, nodes),
            readCalls(checker, ctx.sourceFile),
            Promise.all(handlers.map(handler => isModuleScoped(checker, handler))),
            Promise.all(templates.map(template => specialize(template.expressions, immutables, checker, ctx.constants)))
        ]);

    ctx.attributes = attributes;
    ctx.folds = zip(expressions, folded);
    ctx.parts = parts;
    ctx.reads = reads;
    ctx.scoped = new Set(handlers.filter((_, i) => scoped[i]));
    ctx.variants = zip(templates.map(template => template.node), variants);
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
        let folded = ctx.staticValues?.get(expressions[i]) ?? ctx.folds?.get(expressions[i]) ?? null;

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

// Generated code with every token replaced by its node's composed source (see expand())
function resolve(ctx: CodegenContext, code: string, text: Text): string {
    return code.replace(REGEX_TOKEN, (_, index: string) => expand(ctx, ctx.deferred![Number(index)], text));
}

// Source as it is written, composing nothing
function written(ctx: CodegenContext): Text {
    return (node) => node.getText(ctx.sourceFile);
}

function zip<K, V>(keys: K[], values: V[]): Map<K, V> {
    let map = new Map<K, V>();

    for (let i = 0, n = keys.length; i < n; i++) {
        map.set(keys[i], values[i]);
    }

    return map;
}


// Top-level reactive calls lower first, then root templates. A call nested in a template or
// in an already-lowered call, and a template nested in either, is emitted by its enclosing
// rewrite — emitting it separately would produce overlapping replacements.
// Code is generated here, in source order, so ids and template factories come out the same whatever the
// coordinator composes; the source it copies is composed when the coordinator generates each replacement.
const generateCode = async ({ calls, constants, sites, templates }: Artifacts, sourceFile: ts.SourceFile, checker?: ts.Checker, program?: ts.Program): Promise<CodegenResult> => {
    let ctx: CodegenContext = {
            constants,
            deferred: [],
            hoisted: new Map(),
            markers: new Set(),
            nested: [],
            singles: new Set(),
            sites,
            sourceFile,
            templates: new Map()
        },
        inner: Range[] = [],
        prepend: Prepend[] = [],
        replacements: ReplacementIntent[] = [],
        templateRanges: Range[] = [];

    await prefetch(ctx, templates, checker && checkers.cached(checker, program));

    for (let i = 0, n = templates.length; i < n; i++) {
        let { end, expressions, start } = templates[i];

        templateRanges.push({ end, start });

        for (let j = 0, m = expressions.length; j < m; j++) {
            inner.push({ end: expressions[j].end, start: expressions[j].getStart(sourceFile) });
        }
    }

    let roots: { code: string; node: ts.Node }[] = [];

    for (let i = 0, n = calls.length; i < n; i++) {
        let { end, entrypoint, node, start } = calls[i];

        if (ast.inRange(templateRanges, start, end) || ast.inRange(inner, start, end)) {
            continue;
        }

        inner.push({ end, start });
        roots.push({ code: generateSlotCode(ctx, node, entrypoint, false), node });
    }

    for (let i = 0, n = templates.length; i < n; i++) {
        let { end, node, start } = templates[i];

        if (ast.inRange(inner, start, end)) {
            continue;
        }

        let code = generateNestedTemplateCode(ctx, node);

        roots.push({ code, node: replaced(node, code) });
    }

    for (let [html, id] of ctx.templates) {
        prepend.push(`const ${id} = ${NAMESPACE}.template(${literal(html)}${ctx.singles.has(html) ? ', true' : ''});`);
    }

    // A hoisted constant copying source is composed like a replacement, once the coordinator has composed them all
    for (let { code, id } of ctx.hoisted!.values()) {
        prepend.push(code.includes(TOKEN) ? (text: Text) => `const ${id} = ${resolve(ctx, code, text)};` : `const ${id} = ${code};`);
    }

    for (let i = 0, n = roots.length; i < n; i++) {
        let { code, node } = roots[i];

        replacements.push({ generate: (_sourceFile, text) => resolve(ctx, code, text), node });
    }

    return { nested: ctx.nested!, prepend, replacements, selectorFired: ctx.selectorFired === true, templates: ctx.templates };
};

// Code for the expression, copying its source as a token the coordinator's composed text fills in (see resolve())
const rewriteExpression = (ctx: CodegenContext, expr: ts.Expression): string => {
    if (isHtmlTemplate(expr, ctx.sites)) {
        return generateNestedTemplateCode(ctx, expr);
    }

    let entrypoint = entrypointOf(expr, ctx.sites);

    if (entrypoint) {
        return generateSlotCode(ctx, expr as ts.CallExpression, entrypoint, false);
    }

    let replacements: Nested[] = [],
        rootObserver = ts.isArrowFunction(expr) || ts.isFunctionExpression(expr);

    expr.forEachChild(child => collectNestedReplacements(ctx, child, replacements, rootObserver));

    return defer(ctx, expr, replacements);
};


export { generateCode, resolve, rewriteExpression };
export type { CodegenContext, CodegenResult };
