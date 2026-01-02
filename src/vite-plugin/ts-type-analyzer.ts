import { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS } from '../event/constants';
import ts from 'typescript';


type AnalyzerContext = {
    checker?: ts.TypeChecker;
};

type SlotType =
    | 'array-slot'
    | 'document-fragment'
    | 'effect'
    | 'node'
    | 'primitive'
    | 'static'
    | 'unknown';

type SpreadAnalysis = {
    canUnpack: boolean;
    keys: string[];
};


// Analyze spread expression for compile-time unpacking
// Uses TypeChecker for typed variables when available
function analyzeSpread(expr: ts.Expression, checker?: ts.TypeChecker): SpreadAnalysis {
    while (ts.isParenthesizedExpression(expr)) {
        expr = expr.expression;
    }

    // Object literal - extract known keys at compile time
    if (ts.isObjectLiteralExpression(expr)) {
        let keys: string[] = [];

        for (let i = 0, n = expr.properties.length; i < n; i++) {
            let prop = expr.properties[i];

            if (ts.isPropertyAssignment(prop)) {
                if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) {
                    keys.push(prop.name.text);
                }
            }
            else if (ts.isShorthandPropertyAssignment(prop)) {
                keys.push(prop.name.text);
            }
            // Has spread inside object - can't fully unpack
            else if (ts.isSpreadAssignment(prop)) {
                return { canUnpack: false, keys: [] };
            }
        }

        return { canUnpack: true, keys };
    }

    // TypeChecker-based unpacking for typed variables
    if (checker && (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr))) {
        try {
            let keys = extractTypePropertyKeys(checker.getTypeAtLocation(expr));

            if (keys.length > 0) {
                return { canUnpack: true, keys };
            }
        }
        // TypeChecker failed
        catch {
        }
    }

    return { canUnpack: false, keys: [] };
}

// Extract property keys from a TypeChecker type
function extractTypePropertyKeys(type: ts.Type): string[] {
    let keys: string[] = [],
        props = type.getProperties();

    for (let i = 0, n = props.length; i < n; i++) {
        let prop = props[i],
            name = prop.getName();

        // Skip index signatures and internal properties
        if (name.startsWith('__') || name.startsWith('[')) {
            continue;
        }

        keys.push(name);
    }

    return keys;
}

// Get the value expression for a specific key in an object literal
function getObjectPropertyValue(expr: ts.ObjectLiteralExpression, key: string, sourceFile: ts.SourceFile): string | null {
    for (let i = 0, n = expr.properties.length; i < n; i++) {
        let prop = expr.properties[i];

        if (ts.isPropertyAssignment(prop)) {
            let name = ts.isIdentifier(prop.name) ? prop.name.text :
                       ts.isStringLiteral(prop.name) ? prop.name.text : null;

            if (name === key) {
                return prop.initializer.getText(sourceFile);
            }
        }
        else if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === key) {
            return prop.name.text;
        }
    }

    return null;
}

// Infer slot type from expression AST
// Uses TypeChecker for variable type inference when available
function inferSlotType(expr: ts.Expression, ctx?: AnalyzerContext): SlotType {
    // Unwrap parentheses
    while (ts.isParenthesizedExpression(expr)) {
        expr = expr.expression;
    }

    // Check for effect functions
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        return 'effect';
    }

    // Check for html.reactive (ArraySlot)
    if (
        ts.isCallExpression(expr) &&
        ts.isPropertyAccessExpression(expr.expression) &&
        ts.isIdentifier(expr.expression.expression) &&
        expr.expression.expression.text === 'html' &&
        expr.expression.name.text === 'reactive'
    ) {
        return 'array-slot';
    }

    // Check for nested html template
    if (
        ts.isTaggedTemplateExpression(expr) &&
        ts.isIdentifier(expr.tag) &&
        expr.tag.text === 'html'
    ) {
        return 'document-fragment';
    }

    // Check for array literal
    if (ts.isArrayLiteralExpression(expr)) {
        return 'array-slot';
    }

    // Check for primitive literals
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
        return 'static';
    }

    if (ts.isNumericLiteral(expr)) {
        return 'static';
    }

    if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword) {
        return 'static';
    }

    if (expr.kind === ts.SyntaxKind.NullKeyword || expr.kind === ts.SyntaxKind.UndefinedKeyword) {
        return 'static';
    }

    // Template literal without tag → primitive string
    if (ts.isTemplateExpression(expr)) {
        return 'primitive';
    }

    // Conditional expression - check both branches
    if (ts.isConditionalExpression(expr)) {
        let whenTrue = inferSlotType(expr.whenTrue, ctx),
            whenFalse = inferSlotType(expr.whenFalse, ctx);

        // If both branches are same type, use that
        if (whenTrue === whenFalse) {
            return whenTrue;
        }

        // If one is effect, the whole thing needs effect handling
        if (whenTrue === 'effect' || whenFalse === 'effect') {
            return 'effect';
        }

        return 'unknown';
    }

    // TypeChecker-based inference for identifiers and property access
    if (ctx?.checker) {
        let checker = ctx.checker;

        // For identifiers (variable references)
        if (ts.isIdentifier(expr)) {
            try {
                let type = checker.getTypeAtLocation(expr);

                if (isTypeFunction(type, checker)) {
                    return 'effect';
                }

                if (isTypeArray(type, checker)) {
                    return 'array-slot';
                }
            }
            // TypeChecker failed, fall through to unknown
            catch { }
        }

        // For property access (obj.prop)
        if (ts.isPropertyAccessExpression(expr)) {
            try {
                let type = checker.getTypeAtLocation(expr);

                if (isTypeFunction(type, checker)) {
                    return 'effect';
                }

                if (isTypeArray(type, checker)) {
                    return 'array-slot';
                }
            }
            // TypeChecker failed, fall through to unknown
            catch { }
        }

        // For call expressions - check return type
        if (ts.isCallExpression(expr)) {
            try {
                let type = checker.getTypeAtLocation(expr);

                if (isTypeFunction(type, checker)) {
                    return 'effect';
                }

                if (isTypeArray(type, checker)) {
                    return 'array-slot';
                }
            }
            // TypeChecker failed, fall through to unknown
            catch { }
        }
    }

    return 'unknown';
}

// Check if a TypeChecker type represents a function
function isTypeFunction(type: ts.Type, checker: ts.TypeChecker): boolean {
    // Check for call signatures (functions have them)
    let callSigs = type.getCallSignatures();

    if (callSigs.length > 0) {
        return true;
    }

    // Check union types - if any member is a function, treat as function
    if (type.isUnion()) {
        for (let i = 0, n = type.types.length; i < n; i++) {
            if (isTypeFunction(type.types[i], checker)) {
                return true;
            }
        }
    }

    return false;
}

// Check if a TypeChecker type represents an array
function isTypeArray(type: ts.Type, checker: ts.TypeChecker): boolean {
    let typeStr = checker.typeToString(type);

    // Check for array patterns
    if (typeStr.endsWith('[]') || typeStr.startsWith('Array<') || typeStr.startsWith('ReactiveArray<')) {
        return true;
    }

    // Check symbol for Array
    let symbol = type.getSymbol();

    if (symbol && (symbol.getName() === 'Array' || symbol.getName() === 'ReactiveArray')) {
        return true;
    }

    return false;
}

// Analyze expression AST node directly
// Uses TypeChecker with original AST nodes for full type resolution
const analyzeExpression = (expr: ts.Expression, checker?: ts.TypeChecker): SlotType => {
    return inferSlotType(expr, checker ? { checker } : undefined);
};

// Generate attribute binding code
// Handles: class, style, data-*, events (with routing), spread, generic properties
function generateAttributeBinding(
    elementVar: string,
    name: string,
    expr: string,
    staticValue: string
): string {
    if (name.startsWith('on') && name.length > 2) {
        let event = name.slice(2).toLowerCase(),
            key = name.toLowerCase();

        if (LIFECYCLE_EVENTS.has(key)) {
            return `__event.${key}(${elementVar}, ${expr});`;
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
        return `__setClassPreparsed(${elementVar}, '${staticValue}', ${expr});`;
    }

    if (name === 'style') {
        return `__setStylePreparsed(${elementVar}, '${staticValue}', ${expr});`;
    }

    if (name.startsWith('data-')) {
        return `__setData(${elementVar}, '${name}', ${expr});`;
    }

    return `__setProperty(${elementVar}, '${name}', ${expr});`;
}

// Generate unpacked spread bindings from AST node - preferred method
const generateSpreadBindings = (
    expr: ts.Expression,
    exprCode: string,
    elementVar: string,
    sourceFile: ts.SourceFile,
    checker?: ts.TypeChecker
): string[] => {
    // Unwrap parentheses
    while (ts.isParenthesizedExpression(expr)) {
        expr = expr.expression;
    }

    let analysis = analyzeSpread(expr, checker);

    if (!analysis.canUnpack) {
        return [`__spread(${elementVar}, ${exprCode});`];
    }

    let lines: string[] = [];

    // Object literal - extract values from AST
    if (ts.isObjectLiteralExpression(expr)) {
        for (let i = 0, n = analysis.keys.length; i < n; i++) {
            let key = analysis.keys[i],
                value = getObjectPropertyValue(expr, key, sourceFile);

            if (value !== null) {
                lines.push(generateAttributeBinding(elementVar, key, value, ''));
            }
        }
    }
    // Typed variable - access properties
    else {
        for (let i = 0, n = analysis.keys.length; i < n; i++) {
            let key = analysis.keys[i];

            lines.push(generateAttributeBinding(elementVar, key, `${exprCode}.${key}`, ''));
        }
    }

    return lines;
};

export { analyzeExpression, generateAttributeBinding, generateSpreadBindings };
export type { SlotType };
