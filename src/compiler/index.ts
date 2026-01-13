import { ts } from '@esportsplus/typescript';
import { ast } from '@esportsplus/typescript/compiler';
import type { ImportIntent, ReplacementIntent, TransformContext } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT, ENTRYPOINT_REACTIVITY, NAMESPACE, PACKAGE_NAME } from './constants';
import { generateCode, printer,  rewriteExpression } from './codegen';
import { findHtmlTemplates, findReactiveCalls } from './ts-parser';


export default {
    patterns: [
        `${ENTRYPOINT}\``,
        `${ENTRYPOINT}.${ENTRYPOINT_REACTIVITY}`
    ],
    transform: (ctx: TransformContext) => {
        let callRanges: { end: number; start: number }[] = [],
            callTemplates = new Map<string, string>(),
            imports: ImportIntent[] = [],
            prepend: string[] = [],
            ranges: { end: number; start: number }[] = [],
            remove: string[] = [],
            replacements: ReplacementIntent[] = [],
            templates = findHtmlTemplates(ctx.sourceFile, ctx.checker);

        for (let i = 0, n = templates.length; i < n; i++) {
            ranges.push({
                end: templates[i].end,
                start: templates[i].start
            });
        }

        let calls = findReactiveCalls(ctx.sourceFile, ctx.checker);

        for (let i = 0, n = calls.length; i < n; i++) {
            let call = calls[i];

            if (ast.inRange(ranges, call.start, call.end)) {
                continue;
            }

            // Add callback range so nested templates inside it are excluded from separate processing
            callRanges.push({
                end: call.callbackArg.end,
                start: call.callbackArg.getStart(ctx.sourceFile)
            });

            // Pre-compute the rewritten callback to capture templates
            let rewrittenCallback = rewriteExpression({
                    checker: ctx.checker,
                    sourceFile: ctx.sourceFile,
                    templates: callTemplates
                }, call.callbackArg);

            replacements.push({
                generate: (sourceFile) => `new ${NAMESPACE}.ArraySlot(
                    ${printer.printNode(ts.EmitHint.Expression, call.arrayArg, sourceFile)},
                    ${rewrittenCallback}
                )`,
                node: call.node
            });
        }

        // Add template definitions from reactive call callbacks
        for (let [html, id] of callTemplates) {
            prepend.push(`const ${id} = ${NAMESPACE}.template(\`${html}\`);`);
        }

        if (templates.length > 0) {
            let result = generateCode(templates, ctx.sourceFile, ctx.checker, callRanges);

            prepend.push(...result.prepend);
            replacements.push(...result.replacements);
            remove.push(ENTRYPOINT);
        }

        if (replacements.length === 0 && prepend.length === 0) {
            return {};
        }

        imports.push({
            namespace: NAMESPACE,
            package: PACKAGE_NAME,
            remove: remove
        });

        return { imports, prepend, replacements };
    }
};
