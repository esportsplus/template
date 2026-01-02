// Phase 1-4: Vite Plugin for Compile-Time Template Optimization
//
// Optimizations implemented:
// - #1: Template pre-compilation (eliminates runtime regex parsing)
// - #2: Ancestor-aware path traversal (caches intermediate nodes)
// - #6: WeakMap cache elimination (static imports)
// - #8: Static template bypass (direct clone for no-slot templates)
// - #9: Nested template hoisting (pre-built at module scope)
// - #10: html.reactive inlining → new ArraySlot
// - Uses TypeScript Compiler API for reliable parsing

import ts from 'typescript';
import { parseTemplate, type ParsedTemplate } from './parser';
import { addArraySlotImport, generateCode, generateReactiveInlining, needsArraySlotImport, setTypeChecker } from './codegen';
import { findReactiveCalls } from './ts-parser';
import { getProgram, invalidateProgram } from './program';


type Plugin = {
    enforce?: 'pre' | 'post';
    name: string;
    transform?: (code: string, id: string) => { code: string; map: null } | null;
    watchChange?: (id: string) => void;
};

type PluginOptions = {
    exclude?: RegExp[];
    include?: RegExp[];
    root?: string;
    typeChecker?: boolean;
};


let TRANSFORM_PATTERN = /\.[tj]sx?$/;


function createFilter(include: RegExp[], exclude: RegExp[]) {
    return (id: string) => {
        // Check exclusions first
        for (let i = 0, n = exclude.length; i < n; i++) {
            if (exclude[i].test(id)) {
                return false;
            }
        }

        // Check inclusions
        for (let i = 0, n = include.length; i < n; i++) {
            if (include[i].test(id)) {
                return true;
            }
        }

        return include.length === 0;
    };
}

function mightNeedTransform(code: string): boolean {
    return code.includes('html`') || code.includes('html.reactive');
}


const templatePlugin = (options: PluginOptions = {}): Plugin => {
    let filter = createFilter(
            options.include || [/\.tsx?$/],
            options.exclude || [/node_modules/]
        ),
        root = options.root || process.cwd(),
        templates = new Map<string, ParsedTemplate[]>(),
        typeCheckerEnabled = options.typeChecker !== false;

    return {
        enforce: 'pre',
        name: 'esportsplus-template',

        transform(code, id) {
            if (!filter(id)) {
                return null;
            }

            // Skip if no html template literals or reactive calls
            if (!mightNeedTransform(code)) {
                return null;
            }

            try {
                // Get TypeChecker for deeper type analysis
                if (typeCheckerEnabled) {
                    try {
                        let program = getProgram(root),
                            checker = program.getTypeChecker();

                        setTypeChecker(checker);
                    }
                    catch {
                        // TypeChecker unavailable, continue without it
                        setTypeChecker(undefined);
                    }
                }
                else {
                    setTypeChecker(undefined);
                }

                let changed = false,
                    result = code;

                // Phase 2: Handle html.reactive inlining using TS parser
                let sourceFile = ts.createSourceFile(
                        id,
                        code,
                        ts.ScriptTarget.Latest,
                        true
                    ),
                    reactiveCalls = findReactiveCalls(sourceFile);

                if (reactiveCalls.length > 0) {
                    result = generateReactiveInlining(reactiveCalls, result, sourceFile);
                    changed = true;

                    // Add ArraySlot import if needed
                    if (needsArraySlotImport(result)) {
                        result = addArraySlotImport(result);
                    }
                }

                // Phase 1: Parse and transform html`` templates
                let parsed = parseTemplate(result, id),
                    codegenResult = generateCode(parsed, result);

                if (codegenResult.templates.length) {
                    templates.set(id, codegenResult.templates);
                }

                if (codegenResult.changed) {
                    changed = true;
                    result = codegenResult.code;
                }

                if (!changed) {
                    return null;
                }

                return {
                    code: result,
                    map: null
                };
            }
            catch (error) {
                console.error(`Template transform error in ${id}:`, error);
                return null;
            }
        },

        watchChange(id) {
            // Invalidate TS program cache when files change
            if (TRANSFORM_PATTERN.test(id)) {
                invalidateProgram();
            }
        }
    };
};


export default templatePlugin;
export { templatePlugin };
export type { Plugin, PluginOptions };
