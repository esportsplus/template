import type { ReactiveCallInfo, TemplateInfo } from './ts-parser';
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

// Generate node slot binding code
// Uses original ts.Expression for accurate type analysis
function generateNodeBinding(anchor: string, exprText: string, exprNode?: ts.Expression): string {
    if (!exprNode) {
        needsSlot = true;
        return `__slot(${anchor}, ${exprText});`;
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
    if (!slots || slots.length === 0) {
        return `__fragment(${html})`;
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
                generateNodeBinding(elementVar, exprTexts[index] || 'undefined', exprNodes[index])
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

    let changed = false,
        code = originalCode,
        printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

    // Sort templates by position (end to start) for correct replacement
    // ts-parser returns depth-sorted, but we need position-sorted for string manipulation
    let sorted = templates.slice().sort((a, b) => b.start - a.start);

    // Process templates from end to start (no offset tracking needed)
    for (let i = 0, n = sorted.length; i < n; i++) {
        let exprTexts: string[] = [],
            template = sorted[i];

        for (let j = 0, m = template.expressions.length; j < m; j++) {
            exprTexts.push(printer.printNode(
                ts.EmitHint.Expression,
                template.expressions[j],
                sourceFile
            ));
        }

        let tmpl = generateTemplateCode(
            parser.parse(template.literals) as ParseResult,
            exprTexts,
            template.expressions,
            sourceFile,
            code.slice(0, template.start).trimEnd().endsWith('=>')
        );

        code = code.slice(0, template.start) + tmpl + code.slice(template.end);
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
