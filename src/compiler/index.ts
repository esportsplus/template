import { ts } from '@esportsplus/typescript';
import { imports as sourceImports } from '@esportsplus/typescript/compiler';
import type { ImportIntent, TransformContext } from '@esportsplus/typescript/compiler';
import { ENTRYPOINT, NAMESPACE, PACKAGE_NAME, PACKAGE_REACTIVITY, SIGNAL } from './constants';
import { generateCode } from './codegen';
import { findTemplateArtifacts } from './ts-parser';


// Every use of `html` must compile away: html`` throws at runtime, so an uncompilable use fails
// the build here instead of shipping
function escaped(sourceFile: ts.SourceFile, escapes: ts.Node[]): Error {
    let lines: string[] = [];

    for (let i = 0, n = escapes.length; i < n; i++) {
        let node = escapes[i],
            position = sourceFile.getLineAndCharacterOfPosition(node.getStart()),
            parent = node.parent ?? node;

        lines.push(`  ${sourceFile.fileName}:${position.line + 1}:${position.character + 1}  ${sourceFile.text.slice(parent.getStart(), parent.end).split('\n')[0]}`);
    }

    return new Error(
        `${PACKAGE_NAME}: ${ENTRYPOINT} is compiled away, so it can only be used as a template tag (${ENTRYPOINT}\`...\`), ` +
        `as ${ENTRYPOINT}.reactive(...) / ${ENTRYPOINT}.virtual(...), or through a const alias; it cannot be used as a value:\n${lines.join('\n')}`
    );
}

function hasSignalImport(sourceFile: ts.SourceFile): boolean {
    let infos = sourceImports.all(sourceFile, PACKAGE_REACTIVITY);

    for (let i = 0, n = infos.length; i < n; i++) {
        if (infos[i].specifiers.has(SIGNAL)) {
            return true;
        }
    }

    return false;
}


// No text patterns: a file can reach `html` under any name (a barrel's rename, a default
// re-export), so every file is resolved against the program and only its sites are compiled
export default {
    transform: (ctx: TransformContext) => {
        let artifacts = findTemplateArtifacts(ctx.sourceFile, ctx.checker, ctx.program);

        if (artifacts.escapes.length > 0) {
            throw escaped(ctx.sourceFile, artifacts.escapes);
        }

        let { prepend, replacements, selectorFired } = generateCode(artifacts, ctx.sourceFile, ctx.checker);

        if (replacements.length === 0 && prepend.length === 0) {
            return artifacts.dependencies.length > 0 ? { dependencies: artifacts.dependencies } : {};
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

        return { dependencies: artifacts.dependencies, imports, prepend, replacements };
    }
};
