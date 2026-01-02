import { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS } from '~/event/constants';
import type { ReactiveCallInfo, TemplateInfo } from './ts-parser';
import ts from 'typescript';
import parser from './parser';
import { analyzeExpressionString } from './ts-type-analyzer';


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
    needsEffectSlot = false,
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

// Generate attribute binding code
// Handles: class, style, data-*, events (with routing), spread, generic properties
function generateAttributeBinding(
    elementVar: string,
    name: string,
    expr: string,
    value: string
): string {
    if (name.startsWith('on') && name.length > 2) {
        let event = name.slice(2).toLowerCase(),
            key = name.toLowerCase();

        if (LIFECYCLE_EVENTS.has(key)) {
            return `__event.${event}(${elementVar}, ${expr});`;
        }

        if (DIRECT_ATTACH_EVENTS.has(key)) {
            return `__event.direct(${elementVar}, '${event}', ${expr});`;
        }

        return `__event.delegate(${elementVar}, '${event}', ${expr});`;
    }

    if (name === 'spread') {
        return `__spread(${elementVar}, ${expr});`;
    }

    if (name === 'class') {
        return `__setClassPreparsed(${elementVar}, ${value || ''}, ${expr});`;
    }

    if (name === 'style') {
        return `__setStylePreparsed(${elementVar}, ${value || ''}, ${expr});`;
    }

    if (name.startsWith('data-')) {
        return `__setData(${elementVar}, '${name}', ${expr});`;
    }

    return `__setProperty(${elementVar}, '${name}', ${expr});`;
}

// Generate node slot binding code
function generateNodeBinding(anchor: string, expr: string): string {
    if (analyzeExpressionString(expr, currentChecker) === 'effect') {
        needsEffectSlot = true;
        return `new EffectSlot(${anchor}, ${expr});`;
    }

    return `__slot(${anchor}, ${expr});`;
}

function generateImports(): string {
    return `
        import a from '~/attributes';
        import event from '~/event';

        ${
            needsEffectSlot
                ? `import { EffectSlot } from '~/slot/effect';`
                : `import slot from '~/slot';`
        }

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
        const __setClass = a.setClass;
        const __setClassPreparsed = a.setClassPreparsed;
        const __setData = a.setData;
        const __setProperty = a.setProperty;
        const __setStyle = a.setStyle;
        const __setStylePreparsed = a.setStylePreparsed;
        const __spread = a.spread;

        ${
            needsEffectSlot
                ? ''
                : `const __slot = slot;`
        }
    `;
}

function generateTemplateCode(
    { html, slots }: ParseResult,
    expressions: string[],
    isArrowBody: boolean
): string {

    if (!slots || slots.length === 0) {
        return `__fragment(${html})`;
    }

    let code: string[] = [],
        declarations: string[] = [],
        nodes = new Map<string, string>(),
        varCounter = 0;

    declarations.push(`_root = ${getOrCreateTemplateId(html)}()`);

    for (let i = 0, n = slots.length; i < n; i++) {
        let path = slots[i].path,
            key = path.join('.');

        if (!nodes.has(key) && path.length > 0) {
            let name = `_e${varCounter++}`;

            declarations.push(`${name} = ${`_root${path.length ? '.' : ''}${path.join('.')}`}`);
            nodes.set(key, name);
        }
    }

    // Start function body
    if (isArrowBody) {
        code.push(`{`);
    }
    else {
        code.push(`(() => {`);
    }

    code.push(`    let ${declarations.join(',\n        ')};`);

    let index = 0;

    for (let i = 0, n = slots.length; i < n; i++) {
        let slot = slots[i],
            elementVar = slot.path.length === 0 ? '_root' : (nodes.get(slot.path.join('.')) || '_root');

        if (slot.type === 'attributes') {
            for (let j = 0, m = slot.attributes.names.length; j < m; j++) {
                let name = slot.attributes.names[j];

                code.push(
                    generateAttributeBinding(
                        elementVar,
                        name,
                        expressions[index++] || 'undefined',
                        slot.attributes.statics[name] || ''
                    )
                );
            }
        }
        else {
            code.push(
                generateNodeBinding(elementVar, expressions[index++] || 'undefined')
            );
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
    needsEffectSlot = false;
    templateCounter = 0;

    let changed = false,
        code = originalCode,
        offset = 0,
        printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

    // Process templates in order
    for (let i = 0, n = templates.length; i < n; i++) {
        let expressions: string[] = [],
            template = templates[i];

        for (let j = 0, m = template.expressions.length; j < m; j++) {
            expressions.push(printer.printNode(
                ts.EmitHint.Expression,
                template.expressions[j],
                sourceFile
            ));
        }

        let end = template.end + offset,
            start = template.start + offset,
            tmpl = generateTemplateCode(
                parser.parse(template.literals) as ParseResult,
                expressions,
                code.slice(0, start).trimEnd().endsWith('=>')
            );

        code = code.slice(0, start) + tmpl + code.slice(end);
        offset += tmpl.length - (end - start);
        changed = true;
    }

    // Add hoisted factories and imports
    if (changed && hoistedFactories.size > 0) {
        let factories: string[] = [],
            imports = generateImports();

        for (let [id, html] of hoistedFactories) {
            factories.push(`const ${id} = __fragment(${html});`);
        }

        code = imports + '\n\n' + factories.join('\n') + '\n\n' + code;
    }

    return { changed, code };
}


export { addArraySlotImport, generateCode, generateReactiveInlining, needsArraySlotImport, setTypeChecker };
export type { CodegenResult };
