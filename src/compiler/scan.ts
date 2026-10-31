// Locates top-level export statements in TypeScript without parsing it: what HMR's apply() edits in the lowered
// code. Strings, template literals, comments and regular expressions are skipped whole, so only real code is read.
// JSX text may hold quotes, so JSX is not supported.


type Element = { name: string; property: Range | null; start: number };

type Range = { end: number; start: number };

// One per export statement apply() can wrap, in source order
type Statement =
    | (Range & { kind: 'assignment' | 'function' })
    | { elements: Element[]; kind: 'list' };

type Token = Range & {
    // A line break separates it from the previous token
    broken: boolean;
    kind: 'name' | 'number' | 'punctuator' | 'regex' | 'string' | 'template';
    text: string;
};


const CLOSE: Record<string, string> = { '(': ')', '<': '>', '[': ']', '{': '}' };

// After a line break these go on with the expression; any other name starts the next statement
const CONTINUATIONS = new Set(['as', 'in', 'instanceof', 'satisfies']);

// Punctuators a slash divides; after any other it starts a regular expression
const DIVIDENDS = new Set([')', '++', '--', ']']);

// A slash after these starts a regular expression; after any other name it divides
const KEYWORDS = new Set(['await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new', 'of', 'return', 'throw', 'typeof', 'void', 'yield']);

const PUNCTUATORS = ['...', '=>', '?.', '++', '--'];

const REGEX_LINE_BREAK = /[\n\r\u2028\u2029]/;

// After a line break these start the next statement
const STARTERS = new Set(['!', '++', '--', '@', '{', '~']);

// Type operators a type literal can follow in a return type annotation
const TYPE_OPERATORS = new Set(['asserts', 'extends', 'infer', 'is', 'keyof', 'readonly', 'typeof', 'unique']);


function isIdentifierPart(code: number): boolean {
    return (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 35 || code === 36 || code === 92 || code === 95 || code > 127;
}

function isLineBreak(char: string): boolean {
    return char === '\n' || char === '\r' || char === '\u2028' || char === '\u2029';
}

// `name`, `local as name`, either with a `type` modifier; null for anything else
function specifier(parts: Token[]): Element | null {
    if (parts.length === 2 && parts[0].text === 'type') {
        parts = [parts[1]];
    }
    else if (parts.length === 4 && parts[0].text === 'type' && parts[2].text === 'as') {
        parts = parts.slice(1);
    }

    let name = parts.length === 1 ? parts[0] : parts.length === 3 && parts[1].text === 'as' ? parts[2] : null;

    if (name === null) {
        return null;
    }

    let text = name.kind === 'string' ? name.text.slice(1, -1) : name.text;

    if (text.includes('\\')) {
        return null;
    }

    return {
        name: text,
        property: parts.length === 3 ? { end: parts[0].end, start: parts[0].start } : null,
        start: name.start
    };
}


// Null when the code cannot be read (unterminated literal, unbalanced brackets, an export it cannot follow)
const scan = (code: string): Statement[] | null => {
    let pending: Token[] = [],
        position = 0,
        previous: Token | null = null;

    // Skips a template literal from just past its backtick, code inside substitutions included
    let template = (): boolean => {
        while (position < code.length) {
            let char = code[position];

            if (char === '\\') {
                position += 2;
            }
            else if (char === '`') {
                position++;
                return true;
            }
            else if (char === '$' && code[position + 1] === '{') {
                position += 2;

                if (balance('{') === null) {
                    return false;
                }
            }
            else {
                position++;
            }
        }

        return false;
    };

    let regex = (): boolean => {
        if (previous === null) {
            return true;
        }

        if (previous.kind === 'name') {
            return KEYWORDS.has(previous.text);
        }

        // Nothing increments a regular expression, so a slash after `++` / `--` divides what they incremented
        return previous.kind === 'punctuator' && !DIVIDENDS.has(previous.text);
    };

    let read = (): Token | null => {
        let broken = false;

        while (position < code.length) {
            let char = code[position];

            if (isLineBreak(char)) {
                broken = true;
                position++;
            }
            else if (char === ' ' || char === '\t' || char === '\v' || char === '\f' || char === '\uFEFF' || char === '\u00A0') {
                position++;
            }
            else if (char === '/' && code[position + 1] === '/') {
                while (position < code.length && !isLineBreak(code[position])) {
                    position++;
                }
            }
            else if (char === '/' && code[position + 1] === '*') {
                let end = code.indexOf('*/', position + 2);

                if (end === -1) {
                    return null;
                }

                broken ||= REGEX_LINE_BREAK.test(code.slice(position, end));
                position = end + 2;
            }
            else {
                break;
            }
        }

        if (position >= code.length) {
            return null;
        }

        let char = code[position],
            kind: Token['kind'],
            start = position;

        if (isIdentifierPart(char.charCodeAt(0))) {
            kind = char >= '0' && char <= '9' ? 'number' : 'name';

            while (position < code.length && isIdentifierPart(code.charCodeAt(position))) {
                position++;
            }
        }
        else if (char === '"' || char === "'") {
            kind = 'string';
            position++;

            while (position < code.length && code[position] !== char) {
                if (isLineBreak(code[position])) {
                    return null;
                }

                position += code[position] === '\\' ? 2 : 1;
            }

            position++;
        }
        else if (char === '`') {
            kind = 'template';
            position++;

            if (!template()) {
                return null;
            }
        }
        else if (char === '/' && regex()) {
            let klass = false;

            kind = 'regex';
            position++;

            while (position < code.length && (klass || code[position] !== '/')) {
                if (isLineBreak(code[position])) {
                    return null;
                }

                if (code[position] === '\\') {
                    position++;
                }
                else if (code[position] === '[') {
                    klass = true;
                }
                else if (code[position] === ']') {
                    klass = false;
                }

                position++;
            }

            position++;

            while (position < code.length && isIdentifierPart(code.charCodeAt(position))) {
                position++;
            }
        }
        else {
            let text = char;

            for (let i = 0, n = PUNCTUATORS.length; i < n; i++) {
                if (code.startsWith(PUNCTUATORS[i], position) && !(PUNCTUATORS[i] === '?.' && /\d/.test(code[position + 2] ?? ''))) {
                    text = PUNCTUATORS[i];
                    break;
                }
            }

            kind = 'punctuator';
            position += text.length;
        }

        if (position > code.length) {
            return null;
        }

        return previous = { broken, end: position, kind, start, text: code.slice(start, position) };
    };

    let next = (): Token | null => pending.pop() ?? read();

    let peek = (): Token | null => {
        if (pending.length === 0) {
            let token = read();

            if (token === null) {
                return null;
            }

            pending.push(token);
        }

        return pending[pending.length - 1];
    };

    // Consumes tokens through the bracket closing an already consumed 'open'
    let balance = (open: string): Token | null => {
        let close = CLOSE[open],
            depth = 0;

        for (let token = next(); token !== null; token = next()) {
            if (token.kind !== 'punctuator') {
                continue;
            }

            if (token.text === open) {
                depth++;
            }
            else if (token.text === close && depth-- === 0) {
                return token;
            }
        }

        return null;
    };

    // From just past `function`: its signature, then the end of its body, or of an overload's semicolon
    let declaration = (): number | null => {
        let token = next();

        if (token?.text === '*') {
            token = next();
        }

        if (token?.kind === 'name') {
            token = next();
        }

        if (token?.text === '<') {
            token = balance('<') && next();
        }

        if (token?.text !== '(' || balance('(') === null) {
            return null;
        }

        token = next();

        if (token?.text === ':') {
            let last: Token = token;

            for (token = next(); token !== null; token = next()) {
                if (token.kind === 'punctuator') {
                    if (
                        token.text === '{' &&
                        (last.kind === 'name' ? !TYPE_OPERATORS.has(last.text) : last.kind !== 'punctuator' || ')]}>'.includes(last.text))
                    ) {
                        break;
                    }

                    if (token.text === ';') {
                        return token.end;
                    }

                    if (token.text in CLOSE && (token = balance(token.text)) === null) {
                        return null;
                    }
                }

                last = token;
            }
        }

        if (token?.text === ';') {
            return token.end;
        }

        let close = token?.text === '{' ? balance('{') : null;

        return close ? close.end : null;
    };

    // The end of the expression starting at 'first': at a semicolon, the end of the code, or a line break before a
    // token that cannot go on with it
    let expression = (first: Token): number | null => {
        let depth = first.kind === 'punctuator' && '([{'.includes(first.text) ? 1 : 0,
            end = first.end;

        for (let token = next(); token !== null; token = next()) {
            if (depth === 0) {
                if (token.kind === 'punctuator' && token.text === ';') {
                    return end;
                }

                if (
                    token.broken &&
                    (
                        (token.kind === 'name' && !CONTINUATIONS.has(token.text)) ||
                        token.kind === 'number' ||
                        token.kind === 'string' ||
                        (token.kind === 'punctuator' && STARTERS.has(token.text))
                    )
                ) {
                    pending.push(token);
                    return end;
                }
            }

            if (token.kind === 'punctuator') {
                if ('([{'.includes(token.text)) {
                    depth++;
                }
                else if (')]}'.includes(token.text) && --depth < 0) {
                    return null;
                }
            }

            end = token.end;
        }

        return depth === 0 ? end : null;
    };

    // `{ a, b as c, type d, 'e' as f }`, from just past the brace
    let list = (): Element[] | null => {
        let elements: Element[] = [],
            parts: Token[] = [];

        for (let token = next(); token !== null; token = next()) {
            if (token.kind === 'punctuator' && (token.text === ',' || token.text === '}')) {
                if (parts.length) {
                    let element = specifier(parts);

                    if (element === null) {
                        return null;
                    }

                    elements.push(element);
                    parts = [];
                }

                if (token.text === '}') {
                    return elements;
                }
            }
            else if (token.kind === 'name' || token.kind === 'string') {
                parts.push(token);
            }
            else {
                return null;
            }
        }

        return null;
    };

    let depth = 0,
        member = false,
        statements: Statement[] = [];

    for (let token = next(); token !== null; token = next()) {
        // `a.export` is a member, not a statement
        let named = member;

        member = token.text === '.' || token.text === '?.';

        if (token.kind === 'punctuator') {
            if ('([{'.includes(token.text)) {
                depth++;
            }
            else if (')]}'.includes(token.text)) {
                depth--;
            }

            continue;
        }

        if (depth !== 0 || token.kind !== 'name' || token.text !== 'export' || named) {
            continue;
        }

        let after = next();

        if (after === null) {
            return null;
        }

        if (after.text === 'default') {
            let first = next();

            if (first === null) {
                return null;
            }

            if (first.text === 'function' || (first.text === 'async' && peek()?.text === 'function' && !peek()!.broken)) {
                if (first.text === 'async') {
                    next();
                }

                let end = declaration();

                if (end === null) {
                    return null;
                }

                statements.push({ end, kind: 'function', start: first.start });
            }
            else if (first.text === 'abstract' || first.text === 'class' || first.text === 'interface') {
                pending.push(first);
            }
            else {
                let end = expression(first);

                if (end === null) {
                    return null;
                }

                statements.push({ end, kind: 'assignment', start: first.start });
            }
        }
        else if (after.text === '{' || (after.text === 'type' && peek()?.text === '{')) {
            if (after.text === 'type') {
                next();
            }

            let elements = list();

            if (elements === null) {
                return null;
            }

            if (peek()?.text !== 'from') {
                statements.push({ elements, kind: 'list' });
            }
        }
        else {
            pending.push(after);
        }
    }

    return depth === 0 ? statements : null;
};


export default scan;
export type { Element, Statement };
