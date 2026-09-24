import { ts } from '@esportsplus/typescript';
import { imports as sourceImports } from '@esportsplus/typescript/compiler';
import type { ImportIntent, TransformContext } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT, ENTRYPOINT_REACTIVITY, ENTRYPOINT_VIRTUAL, NAMESPACE, PACKAGE_NAME, PACKAGE_REACTIVITY, SIGNAL } from './constants';
import { generateCode } from './codegen';
import { findTemplateArtifacts } from './ts-parser';


function hasSignalImport(sourceFile: ts.SourceFile): boolean {
    let infos = sourceImports.all(sourceFile, PACKAGE_REACTIVITY);

    for (let i = 0, n = infos.length; i < n; i++) {
        if (infos[i].specifiers.has(SIGNAL)) {
            return true;
        }
    }

    return false;
}


export default {
    patterns: [
        `${ENTRYPOINT}\``,
        `${ENTRYPOINT}.${ENTRYPOINT_REACTIVITY}`,
        `${ENTRYPOINT}.${ENTRYPOINT_VIRTUAL}`
    ],
    transform: (ctx: TransformContext) => {
        let artifacts = findTemplateArtifacts(ctx.sourceFile, ctx.checker),
            { prepend, replacements, selectorFired } = generateCode(artifacts, ctx.sourceFile, ctx.checker);

        if (replacements.length === 0 && prepend.length === 0) {
            return {};
        }

        let imports: ImportIntent[] = [{
            namespace: NAMESPACE,
            package: PACKAGE_NAME,
            remove: artifacts.templates.length > 0 ? [ENTRYPOINT] : []
        }];

        if (selectorFired && !hasSignalImport(ctx.sourceFile)) {
            imports.push({
                add: [SIGNAL],
                package: PACKAGE_REACTIVITY
            });
        }

        return { imports, prepend, replacements };
    }
};
