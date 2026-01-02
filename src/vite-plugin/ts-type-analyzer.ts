import ts from 'typescript';


type AnalyzerContext = {
    checker?: ts.TypeChecker;
    sourceFile?: ts.SourceFile;
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
function analyzeSpread(expr: ts.Expression): SpreadAnalysis {
    // Unwrap parentheses
    while (ts.isParenthesizedExpression(expr)) {
        expr = expr.expression;
    }

    // Object literal - extract known keys at compile time
    if (ts.isObjectLiteralExpression(expr)) {
        let keys: string[] = [];

        for (let i = 0, n = expr.properties.length; i < n; i++) {
            let prop = expr.properties[i];

            if (ts.isPropertyAssignment(prop)) {
                if (ts.isIdentifier(prop.name)) {
                    keys.push(prop.name.text);
                }
                else if (ts.isStringLiteral(prop.name)) {
                    keys.push(prop.name.text);
                }
            }
            else if (ts.isShorthandPropertyAssignment(prop)) {
                keys.push(prop.name.text);
            }
            else if (ts.isSpreadAssignment(prop)) {
                // Has spread inside object - can't fully unpack
                return { canUnpack: false, keys: [] };
            }
        }

        return { canUnpack: true, keys };
    }

    // Variable or other expression - can't unpack without TypeChecker
    return { canUnpack: false, keys: [] };
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
    if (ctx?.checker && ctx.sourceFile) {
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
            catch {
                // TypeChecker failed, fall through to unknown
            }
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
            catch {
                // TypeChecker failed, fall through to unknown
            }
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
            catch {
                // TypeChecker failed, fall through to unknown
            }
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

// Parse expression string to AST node
function parseExpression(code: string): ts.Expression | null {
    let sourceFile = ts.createSourceFile(
        'expr.ts',
        `(${code})`,
        ts.ScriptTarget.Latest,
        true
    );

    let statement = sourceFile.statements[0];

    if (ts.isExpressionStatement(statement)) {
        let expr = statement.expression;

        // Unwrap parentheses we added
        if (ts.isParenthesizedExpression(expr)) {
            return expr.expression;
        }

        return expr;
    }

    return null;
}


// Analyze expression string and return slot type
// Accepts optional TypeChecker for deeper analysis
const analyzeExpressionString = (code: string, checker?: ts.TypeChecker): SlotType => {
    let expr = parseExpression(code);

    if (!expr) {
        return 'unknown';
    }

    // When TypeChecker available, we can resolve variable types
    // Note: The parsed expression is from a synthetic file, so TypeChecker
    // cannot resolve external references. For full TypeChecker support,
    // use analyzeExpressionWithChecker with actual source file node.
    return inferSlotType(expr, checker ? { checker } : undefined);
};

// Generate unpacked spread bindings from expression string
const generateUnpackedSpreadBindings = (exprCode: string, elementVar: string): string[] => {
    let expr = parseExpression(exprCode);

    if (!expr) {
        return [`    __spread(${elementVar}, ${exprCode});`];
    }

    // Unwrap parentheses
    while (ts.isParenthesizedExpression(expr)) {
        expr = expr.expression;
    }

    if (!ts.isObjectLiteralExpression(expr)) {
        return [`    __spread(${elementVar}, ${exprCode});`];
    }

    let analysis = analyzeSpread(expr);

    if (!analysis.canUnpack) {
        return [`    __spread(${elementVar}, ${exprCode});`];
    }

    let lines: string[] = [],
        sourceFile = ts.createSourceFile('expr.ts', `(${exprCode})`, ts.ScriptTarget.Latest, true);

    for (let i = 0, n = analysis.keys.length; i < n; i++) {
        let key = analysis.keys[i],
            value = getObjectPropertyValue(expr, key, sourceFile);

        if (value !== null) {
            // #4: Use specialized handlers based on attribute name
            if (key.startsWith('on') && key.length > 2) {
                let eventName = key.slice(2).toLowerCase();

                lines.push(`    __event(${elementVar}, '${eventName}', ${value});`);
            }
            else if (key === 'class') {
                lines.push(`    __setClass(${elementVar}, ${value});`);
            }
            else if (key === 'style') {
                lines.push(`    __setStyle(${elementVar}, ${value});`);
            }
            else if (key[0] === 'd' && key.startsWith('data-')) {
                lines.push(`    __setData(${elementVar}, '${key}', ${value});`);
            }
            else {
                lines.push(`    __setProperty(${elementVar}, '${key}', ${value});`);
            }
        }
    }

    return lines;
}


export { analyzeExpressionString, generateUnpackedSpreadBindings };
export type { SlotType };
