import ts from 'typescript';


type ImportModification = {
    module: string;
    specifiers: Set<string>;
};

type NodeMatch<T> = {
    data: T;
    end: number;
    node: ts.Node;
    start: number;
};

type QuickCheckPattern = {
    patterns?: string[];
    regex?: RegExp;
};

type Replacement = {
    end: number;
    newText: string;
    start: number;
};

type VisitorCallback<T> = (node: ts.Node, state: T) => void;

type VisitorPredicate = (node: ts.Node) => boolean;


// Apply text replacements efficiently in single pass
function applyReplacements(code: string, replacements: Replacement[]): string {
    if (replacements.length === 0) {
        return code;
    }

    // Sort by start position ascending for single-pass building
    replacements.sort((a, b) => a.start - b.start);

    let parts: string[] = [],
        pos = 0;

    for (let i = 0, n = replacements.length; i < n; i++) {
        let r = replacements[i];

        if (r.start > pos) {
            parts.push(code.substring(pos, r.start));
        }

        parts.push(r.newText);
        pos = r.end;
    }

    if (pos < code.length) {
        parts.push(code.substring(pos));
    }

    return parts.join('');
}

// Apply replacements in reverse order (end-to-start) - avoids offset tracking
function applyReplacementsReverse(code: string, replacements: Replacement[]): string {
    if (replacements.length === 0) {
        return code;
    }

    // Sort by start position descending
    replacements.sort((a, b) => b.start - a.start);

    let result = code;

    for (let i = 0, n = replacements.length; i < n; i++) {
        let r = replacements[i];

        result = result.substring(0, r.start) + r.newText + result.substring(r.end);
    }

    return result;
}

// Collect AST nodes matching a predicate with position info
function collectNodes<T>(
    sourceFile: ts.SourceFile,
    predicate: (node: ts.Node) => T | null
): NodeMatch<T>[] {
    let matches: NodeMatch<T>[] = [];

    function visit(node: ts.Node): void {
        let data = predicate(node);

        if (data !== null) {
            matches.push({
                data,
                end: node.end,
                node,
                start: node.getStart(sourceFile)
            });
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return matches;
}

// Quick string-based check before expensive AST parsing
function mightNeedTransform(code: string, check: QuickCheckPattern): boolean {
    if (check.regex) {
        return check.regex.test(code);
    }

    if (check.patterns) {
        for (let i = 0, n = check.patterns.length; i < n; i++) {
            if (code.includes(check.patterns[i])) {
                return true;
            }
        }
    }

    return false;
}

// Update import statement for a specific module
function updateImports(code: string, modification: ImportModification): string {
    let { module, specifiers } = modification;

    if (specifiers.size === 0) {
        return code;
    }

    // Escape special regex characters in module name
    let escapedModule = module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        importRegex = new RegExp(`(import\\s*\\{[^}]*\\}\\s*from\\s*['"]${escapedModule}['"])`),
        match = code.match(importRegex);

    if (!match) {
        return code;
    }

    let existingImport = match[1],
        existingSpecifiers = existingImport.match(/\{([^}]*)\}/)?.[1] ?? '',
        existing = new Set(existingSpecifiers.split(',').map(s => s.trim()).filter(Boolean)),
        toAdd: string[] = [];

    for (let spec of specifiers) {
        if (!existing.has(spec)) {
            toAdd.push(spec);
        }
    }

    if (toAdd.length === 0) {
        return code;
    }

    let newSpecifiers = [...existing, ...toAdd].filter(Boolean).sort().join(', '),
        newImport = existingImport.replace(/\{[^}]*\}/, `{ ${newSpecifiers} }`);

    return code.replace(existingImport, newImport);
}

// Add a new import statement at the beginning of imports
function addImport(code: string, module: string, specifiers: string[]): string {
    if (specifiers.length === 0) {
        return code;
    }

    // Check if import already exists
    let escapedModule = module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (new RegExp(`import\\s*\\{[^}]*\\}\\s*from\\s*['"]${escapedModule}['"]`).test(code)) {
        return updateImports(code, { module, specifiers: new Set(specifiers) });
    }

    let importStatement = `import { ${specifiers.sort().join(', ')} } from '${module}';\n`,
        firstImport = code.indexOf('import ');

    if (firstImport === -1) {
        return importStatement + code;
    }

    return code.substring(0, firstImport) + importStatement + code.substring(firstImport);
}

// Generic AST visitor with optional filtering
function visitAst<T>(
    sourceFile: ts.SourceFile,
    callback: VisitorCallback<T>,
    state: T,
    predicate?: VisitorPredicate
): T {
    function visit(node: ts.Node): void {
        if (!predicate || predicate(node)) {
            callback(node, state);
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return state;
}

// Visit AST with depth tracking (useful for template nesting)
function visitAstWithDepth<T>(
    sourceFile: ts.SourceFile,
    callback: (node: ts.Node, depth: number, state: T) => void,
    state: T,
    depthTrigger: (node: ts.Node) => boolean
): T {
    function visit(node: ts.Node, depth: number): void {
        let nextDepth = depthTrigger(node) ? depth + 1 : depth;

        callback(node, depth, state);
        ts.forEachChild(node, child => visit(child, nextDepth));
    }

    visit(sourceFile, 0);

    return state;
}


export { addImport, applyReplacements, applyReplacementsReverse, collectNodes, mightNeedTransform, updateImports, visitAst, visitAstWithDepth };
export type { ImportModification, NodeMatch, QuickCheckPattern, Replacement, VisitorCallback, VisitorPredicate };
