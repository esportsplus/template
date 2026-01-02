// Phase 1: Template Literal AST Parser
// Parses html`...` template literals at build time
// Extracts slot metadata for compile-time optimization
//
// Template finding uses TypeScript Compiler API (ts-parser.ts)
// This module only handles HTML slot parsing

import ts from 'typescript';
import { findHtmlTemplates, getTemplateExpressions, type TemplateInfo } from './ts-parser';


type NodeType = 'closing' | 'comment' | 'element' | 'slot' | 'void';

type ParsedSlot = {
    expression: string;
    index: number;
    isAttribute: boolean;
    isEvent: boolean;
    isSpread: boolean;
    name: string | null;
    path: PathStep[];
    type: 'effect' | 'static' | 'unknown';
};

type ParsedTemplate = {
    end: number;
    hasNestedTemplates: boolean;
    hoistedId: string | null;
    html: string;
    id: string;
    isStatic: boolean;
    nestedTemplates: ParsedTemplate[];
    slots: ParsedSlot[];
    start: number;
};

type PathStep = {
    method: 'firstChild' | 'firstElementChild' | 'nextElementSibling' | 'nextSibling';
    count: number;
};


let counter = 0,
    NODE_VOID: Record<string, boolean> = {
        area: true,
        base: true,
        br: true,
        col: true,
        embed: true,
        hr: true,
        img: true,
        input: true,
        keygen: true,
        link: true,
        menuitem: true,
        meta: true,
        param: true,
        source: true,
        track: true,
        wbr: true
    },
    REGEX_EMPTY_TEXT_NODES = /(>|}|\s)\s+(<|{|\s)/g,
    REGEX_EVENTS = /^on[a-z]/,
    REGEX_SLOT_MARKER = /\{\{\$\}\}/g,
    REGEX_TAG = /<(\/)?([a-zA-Z][\w-]*)[^>]*>/g,
    SLOT_MARKER = '{{$}}';


function generateId(): string {
    return `__tmpl_${counter++}`;
}

function getNodeType(tag: string, isClosing: boolean): NodeType {
    if (isClosing) {
        return 'closing';
    }

    if (tag[0] === '!') {
        return 'comment';
    }

    if (NODE_VOID[tag.toLowerCase()]) {
        return 'void';
    }

    return 'element';
}

// #2: Ancestor-aware Path Traversal Optimization
// Build path tree from all slots, identify common ancestor prefixes,
// generate traversal order that maximizes sibling chains
function buildOptimizedPaths(slots: ParsedSlot[]): void {
    if (slots.length === 0) {
        return;
    }

    // Group slots by parent path (all but last step)
    let pathGroups = new Map<string, ParsedSlot[]>();

    for (let i = 0, n = slots.length; i < n; i++) {
        let slot = slots[i];

        // Skip slots with empty paths
        if (slot.path.length === 0) {
            continue;
        }

        let parentPath = slot.path.slice(0, -1),
            key = JSON.stringify(parentPath);

        if (!pathGroups.has(key)) {
            pathGroups.set(key, []);
        }

        pathGroups.get(key)!.push(slot);
    }

    // Sort siblings within each group by their final step
    for (let group of pathGroups.values()) {
        group.sort((a, b) => {
            let aLast = a.path[a.path.length - 1],
                bLast = b.path[b.path.length - 1];

            // Guard against undefined (shouldn't happen after filter above)
            if (!aLast || !bLast) {
                return 0;
            }

            return aLast.count - bLast.count;
        });
    }
}

// Issue 3: Fixed attribute slot detection
// Only track slots inside element tags (between < and >), not in text content
function parseAttributes(html: string, slotIndex: number[]): ParsedSlot[] {
    let attr = '',
        buffer = '',
        char = '',
        inTag = false,
        quote = '',
        result: ParsedSlot[] = [],
        slotIdx = 0;

    for (let i = 0, n = html.length; i < n; i++) {
        char = html[i];

        // Track whether we're inside an element tag
        if (char === '<' && !quote) {
            inTag = true;
            attr = '';
            buffer = '';
            continue;
        }

        if (char === '>' && !quote) {
            inTag = false;
            attr = '';
            buffer = '';
            continue;
        }

        // Only parse attributes when inside a tag
        if (!inTag) {
            // Still need to count slots in text content to keep slotIdx in sync
            if (char === '{' && html.slice(i, i + 5) === '{{$}}') {
                slotIdx++;
                i += 4;
            }

            continue;
        }

        if (char === ' ' || char === '\n' || char === '\t') {
            if (!quote) {
                buffer = '';
            }
            else {
                buffer += char;
            }
        }
        else if (char === '=') {
            if (!quote) {
                attr = buffer;
                buffer = '';
            }
            else {
                buffer += char;
            }
        }
        else if (char === '"' || char === "'") {
            if (!quote) {
                quote = char;
            }
            else if (quote === char) {
                attr = '';
                buffer = '';
                quote = '';
            }
        }
        else if (char === '{' && html.slice(i, i + 5) === '{{$}}') {
            if (attr) {
                result.push({
                    expression: '',
                    index: slotIndex[slotIdx],
                    isAttribute: true,
                    isEvent: REGEX_EVENTS.test(attr),
                    isSpread: false,
                    name: attr,
                    path: [],
                    type: 'unknown'
                });
            }
            else {
                // Spread attribute (no name)
                result.push({
                    expression: '',
                    index: slotIndex[slotIdx],
                    isAttribute: true,
                    isEvent: false,
                    isSpread: true,
                    name: null,
                    path: [],
                    type: 'unknown'
                });
            }

            slotIdx++;
            i += 4;

            if (!quote) {
                attr = '';
            }
        }
        else {
            buffer += char;
        }
    }

    return result;
}

function parseTemplateHtml(literals: string[]): { html: string; slotCount: number } {
    let html = literals.join(SLOT_MARKER)
            .replace(REGEX_EMPTY_TEXT_NODES, '$1$2')
            .trim(),
        slotCount = literals.length - 1;

    return { html, slotCount };
}

// Issue 4: Extract nested html`...` templates from an expression
// Returns array of nested template positions relative to the expression start
function extractNestedTemplates(expression: string): { content: string; end: number; start: number }[] {
    let depth = 0,
        inNestedTemplate = false,
        nestedStart = -1,
        result: { content: string; end: number; start: number }[] = [];

    for (let i = 0, n = expression.length; i < n; i++) {
        let char = expression[i];

        // Check for html` start
        if (!inNestedTemplate && expression.slice(i, i + 5) === 'html`') {
            nestedStart = i;
            inNestedTemplate = true;
            depth = 0;
            i += 4;
            continue;
        }

        if (inNestedTemplate) {
            // Track ${...} interpolations within the nested template
            if (char === '$' && expression[i + 1] === '{') {
                depth++;
                i++;
                continue;
            }

            if (depth > 0) {
                if (char === '{') {
                    depth++;
                }
                else if (char === '}') {
                    depth--;
                }

                continue;
            }

            // End of nested template literal
            if (char === '`') {
                result.push({
                    content: expression.slice(nestedStart, i + 1),
                    end: i + 1,
                    start: nestedStart
                });

                inNestedTemplate = false;
                nestedStart = -1;
            }
        }
    }

    return result;
}

// Build DOM traversal paths for slots
function buildSlotPaths(html: string, slots: ParsedSlot[]): void {
    if (slots.length === 0) {
        return;
    }

    let level = 0,
        levels: { children: number; elements: number; isElement: boolean; path: PathStep[] }[] = [{
            children: 0,
            elements: 0,
            isElement: false,
            path: []
        }],
        match: RegExpExecArray | null,
        slotIdx = 0,
        textBefore = '';

    // Find slot positions and build paths
    REGEX_TAG.lastIndex = 0;

    let lastIdx = 0,
        slotPositions: number[] = [];

    // Find all slot marker positions
    REGEX_SLOT_MARKER.lastIndex = 0;

    while (match = REGEX_SLOT_MARKER.exec(html)) {
        slotPositions.push(match.index);
    }

    // Build paths based on DOM structure
    REGEX_TAG.lastIndex = 0;
    lastIdx = 0;

    while (match = REGEX_TAG.exec(html)) {
        let parent = levels[level],
            tag = match[2],
            isClosing = match[1] === '/',
            type = getNodeType(tag, isClosing);

        // Check for text nodes between last position and this tag
        textBefore = html.slice(lastIdx, match.index).trim();

        if (textBefore.length > 0) {
            // Count text nodes (including slots)
            let textParts = textBefore.split(SLOT_MARKER);

            for (let i = 0, n = textParts.length; i < n; i++) {
                if (i > 0) {
                    // This is a slot - assign path
                    let attrSlot = slots.find(s => s.index === slotIdx && s.isAttribute);

                    if (!attrSlot) {
                        // Node slot
                        let path = parent.path.slice();

                        if (path.length === 0) {
                            path.push({ method: 'firstChild', count: parent.children });
                        }
                        else {
                            path.push({ method: 'nextSibling', count: parent.children });
                        }

                        let slot = slots.find(s => s.index === slotIdx);

                        if (slot) {
                            slot.path = path;
                        }
                    }

                    slotIdx++;
                }

                if (textParts[i].trim().length > 0) {
                    parent.children++;
                }
            }
        }

        if (type === 'element' || type === 'void') {
            // Build path for this element
            let path: PathStep[];

            if (parent.path.length === 0) {
                path = [{ method: 'firstElementChild', count: parent.elements }];
            }
            else {
                path = parent.path.slice();

                if (parent.elements === 0) {
                    path.push({ method: 'firstElementChild', count: 0 });
                }
                else {
                    path.push({ method: 'nextElementSibling', count: parent.elements });
                }
            }

            // Check for attribute slots in this tag
            let attrSlots = slots.filter(s => s.isAttribute && s.index >= slotIdx);

            for (let i = 0, n = attrSlots.length; i < n; i++) {
                attrSlots[i].path = path;
            }

            if (type === 'element') {
                levels[++level] = {
                    children: 0,
                    elements: 0,
                    isElement: true,
                    path
                };
            }

            parent.elements++;
            parent.children++;
        }
        else if (type === 'closing') {
            level--;
        }

        lastIdx = match.index + match[0].length;
    }

    // Handle remaining content after last tag
    textBefore = html.slice(lastIdx).trim();

    if (textBefore.length > 0) {
        let parent = levels[level],
            textParts = textBefore.split(SLOT_MARKER);

        for (let i = 0, n = textParts.length; i < n; i++) {
            if (i > 0) {
                let attrSlot = slots.find(s => s.index === slotIdx && s.isAttribute);

                if (!attrSlot) {
                    let path = parent.path.slice();

                    if (path.length === 0) {
                        path.push({ method: 'firstChild', count: parent.children });
                    }
                    else {
                        path.push({ method: 'nextSibling', count: parent.children });
                    }

                    let slot = slots.find(s => s.index === slotIdx);

                    if (slot) {
                        slot.path = path;
                    }
                }

                slotIdx++;
            }

            if (textParts[i].trim().length > 0) {
                parent.children++;
            }
        }
    }

    buildOptimizedPaths(slots);
}

// Parse a single template from TemplateInfo (from TS parser)
function parseTemplateFromInfo(info: TemplateInfo, sourceFile: ts.SourceFile): ParsedTemplate {
    let { html, slotCount } = parseTemplateHtml(info.literals),
        expressions = getTemplateExpressions(info, sourceFile),
        id = generateId(),
        isStatic = slotCount === 0,
        slots: ParsedSlot[] = [];

    // Create slots for each interpolation
    for (let j = 0; j < slotCount; j++) {
        slots.push({
            expression: expressions[j] || '',
            index: j,
            isAttribute: false,
            isEvent: false,
            isSpread: false,
            name: null,
            path: [],
            type: 'unknown'
        });
    }

    // Parse attributes to identify attribute slots
    let attrSlots = parseAttributes(html, slots.map(s => s.index));

    for (let j = 0, m = attrSlots.length; j < m; j++) {
        let attrSlot = attrSlots[j],
            existingSlot = slots.find(s => s.index === attrSlot.index);

        if (existingSlot) {
            existingSlot.isAttribute = attrSlot.isAttribute;
            existingSlot.isEvent = attrSlot.isEvent;
            existingSlot.isSpread = attrSlot.isSpread;
            existingSlot.name = attrSlot.name;
        }
    }

    // Build DOM traversal paths
    buildSlotPaths(html, slots);

    // Check for nested templates
    let hasNestedTemplates = html.includes('html`'),
        nestedTemplates: ParsedTemplate[] = [];

    return {
        end: info.end,
        hasNestedTemplates,
        hoistedId: null,
        html,
        id,
        isStatic,
        nestedTemplates,
        slots,
        start: info.start
    };
}

function parseTemplate(code: string, fileId: string): ParsedTemplate[] {
    let sourceFile = ts.createSourceFile(
            fileId,
            code,
            ts.ScriptTarget.Latest,
            true
        ),
        templates = findHtmlTemplates(sourceFile),
        result: ParsedTemplate[] = [];

    for (let i = 0, n = templates.length; i < n; i++) {
        result.push(parseTemplateFromInfo(templates[i], sourceFile));
    }

    return result;
}


export { extractNestedTemplates, parseTemplate };
export type { ParsedSlot, ParsedTemplate, PathStep };
