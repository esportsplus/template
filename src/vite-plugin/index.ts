// Vite Plugin for Compile-Time Template Optimization
//
// Uses:
// - ts-parser.ts for finding html`` templates via TypeScript AST
// - _parser.ts for parsing HTML and extracting slots
// - codegen.ts for generating optimized runtime code
//
// Optimizations:
// - Template pre-compilation (eliminates runtime parsing)
// - Attribute handler specialization (class, style, data-*, events)
// - Event routing (delegate, direct, lifecycle)
// - Static value pre-joining
// - Template deduplication
// - html.reactive inlining → new ArraySlot


import ts from 'typescript';
import { addArraySlotImport, generateCode, generateReactiveInlining, needsArraySlotImport, setTypeChecker } from './codegen';
import { findHtmlTemplates, findReactiveCalls } from './ts-parser';
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


const DEFAULT_EXCLUDE = [/node_modules/];

const DEFAULT_INCLUDE = [/\.tsx?$/];

const TRANSFORM_PATTERN = /\.[tj]sx?$/;


const templatePlugin = (options: PluginOptions = {}): Plugin => {
    let exclude = options.exclude || DEFAULT_EXCLUDE,
        include = options.include || DEFAULT_INCLUDE,
        root = options.root || process.cwd(),
        typeCheckerEnabled = options.typeChecker !== false;

    let filter = (id: string) => {
        for (let i = 0, n = exclude.length; i < n; i++) {
            if (exclude[i].test(id)) {
                return false;
            }
        }

        for (let i = 0, n = include.length; i < n; i++) {
            if (include[i].test(id)) {
                return true;
            }
        }

        return include.length === 0;
    };

    return {
        enforce: 'pre',
        name: 'esportsplus-template',

        transform(code, id) {
            if (!filter(id)) {
                return null;
            }

            if (!code.includes('html`') && !code.includes('html.reactive')) {
                return null;
            }

            try {
                let changed = false,
                    result = code,
                    sourceFile: ts.SourceFile;

                // Get TypeChecker and sourceFile from program for type analysis
                // TypeChecker can only resolve types for nodes in its own program's AST
                if (typeCheckerEnabled) {
                    try {
                        let program = getProgram(root),
                            checker = program.getTypeChecker(),
                            programSourceFile = program.getSourceFile(id);

                        if (programSourceFile) {
                            sourceFile = programSourceFile;
                            setTypeChecker(checker);
                        }
                        else {
                            // File not in program - fall back to standalone parsing
                            sourceFile = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true);
                            setTypeChecker(undefined);
                        }
                    }
                    catch {
                        sourceFile = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true);
                        setTypeChecker(undefined);
                    }
                }
                else {
                    sourceFile = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true);
                    setTypeChecker(undefined);
                }

                // Handle html.reactive inlining
                let reactiveCalls = findReactiveCalls(sourceFile);

                if (reactiveCalls.length > 0) {
                    result = generateReactiveInlining(reactiveCalls, result, sourceFile);
                    changed = true;

                    if (needsArraySlotImport(result)) {
                        result = addArraySlotImport(result);
                    }

                    // Re-parse after modifications - TypeChecker no longer valid for new AST
                    sourceFile = ts.createSourceFile(id, result, ts.ScriptTarget.Latest, true);
                    setTypeChecker(undefined);
                }

                // Find and transform html`` templates
                let templates = findHtmlTemplates(sourceFile);

                if (templates.length > 0) {
                    let codegenResult = generateCode(templates, result, sourceFile);

                    if (codegenResult.changed) {
                        changed = true;
                        result = codegenResult.code;
                    }
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
            if (TRANSFORM_PATTERN.test(id)) {
                invalidateProgram();
            }
        }
    };
};


export default templatePlugin;
export { templatePlugin };
export type { Plugin, PluginOptions };
