import { ts } from '@esportsplus/typescript';
import { references } from '@esportsplus/typescript/compiler';
import { findTemplateArtifacts } from '../../../src/compiler/ts-parser';


type Found = { dependencies: string[]; escapes: string[]; sites: string[] };


const ENTRYPOINT = 'html';

const ENTRYPOINTS = new Set(['reactive', 'virtual']);

const PACKAGE_NAME = '@esportsplus/template';


function isConst(declaration: ts.Node): boolean {
    let node: ts.Node | undefined = declaration;

    while (node && (ts.isBindingElement(node) || ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node))) {
        node = node.parent;
    }

    return node !== undefined &&
        ts.isVariableDeclaration(node) &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0;
}

function isLowered(site: ts.Node): boolean {
    let parent = site.parent;

    if (!parent) {
        return false;
    }

    if (ts.isTaggedTemplateExpression(parent)) {
        return parent.tag === site;
    }

    if (ts.isPropertyAccessExpression(parent)) {
        return parent.expression === site &&
            ENTRYPOINTS.has(parent.name.text) &&
            parent.parent !== undefined &&
            ts.isCallExpression(parent.parent) &&
            parent.parent.expression === parent;
    }

    if (ts.isVariableDeclaration(parent)) {
        return parent.initializer === site && ts.isIdentifier(parent.name) && isConst(parent);
    }

    return ts.isBindingElement(parent) && parent.propertyName === site && isConst(parent);
}

function label(node: ts.Node, sourceFile: ts.SourceFile): string {
    return `${node.getStart(sourceFile)}:${node.kind}:${node.getText(sourceFile)}`;
}


// The site search spelled out on references.origins, which resolves every value identifier in the file:
// the oracle the compiler's search must agree with.
const reference = (sourceFile: ts.SourceFile, checker: ts.Checker, program: ts.Program): Found => {
    let dependencies = new Set<string>(),
        escapes: string[] = [],
        self = sourceFile.fileName.toLowerCase(),
        sites = new Set<ts.Node>(),
        targets = new Set(references.exported(checker, program, PACKAGE_NAME, ENTRYPOINT).map(references.key));

    if (targets.size > 0) {
        for (let [identifier, origin] of references.origins(checker, program, sourceFile)) {
            if (!references.holds(checker, program, origin, targets)) {
                continue;
            }

            let parent = identifier.parent!;

            sites.add(
                (ts.isPropertyAccessExpression(parent) && parent.name === identifier) ||
                (ts.isElementAccessExpression(parent) && parent.argumentExpression === identifier)
                    ? parent
                    : identifier
            );

            for (let file of [...origin.through, origin.declaration.path]) {
                if (file.toLowerCase() !== self) {
                    dependencies.add(file);
                }
            }
        }
    }

    for (let site of sites) {
        if (!isLowered(site)) {
            escapes.push(label(site, sourceFile));
        }
    }

    return {
        dependencies: [...dependencies].map(file => file.toLowerCase()).sort(),
        escapes: escapes.sort(),
        sites: [...sites].map(site => label(site, sourceFile)).sort()
    };
};

const found = (sourceFile: ts.SourceFile, checker: ts.Checker, program: ts.Program): Found => {
    let artifacts = findTemplateArtifacts(sourceFile, checker, program);

    return {
        dependencies: [...new Set(artifacts.dependencies.map(file => file.toLowerCase()))].sort(),
        escapes: artifacts.escapes.map(site => label(site, sourceFile)).sort(),
        sites: [...artifacts.sites].map(site => label(site, sourceFile)).sort()
    };
};


export { found, reference };
export type { Found };
