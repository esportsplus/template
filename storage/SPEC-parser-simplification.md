# Parser Simplification Spec

## Problem

`parser.ts` grew complex trying to handle nested templates, path building, and TS integration. The original `_parser.ts` is simpler and more focused - it just parses one template.

## Architecture (IMPLEMENTED)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ts-parser.ts  │────▶│    parser.ts    │────▶│   codegen.ts    │
│ (finds ALL html)│     │ (parse 1 tmpl)  │     │ (generates code)│
│ (AST traversal) │     │ (returns slots) │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## parser.ts Slot Types

```typescript
type Slot =
    | { type: 'slot'; path: NodePath }
    | { type: 'attributes'; path: NodePath; attributes: AttributeMetadata };

type AttributeMetadata = {
    names: string[];                    // ['class', 'onclick', 'spread'] - in slot order
    statics: Record<string, string>;    // { class: 'btn  active' } - pre-joined static values
};
```

### Node Slot
For text content interpolation: `<div>${value}</div>`
```typescript
{ type: 'slot', path: ['firstElementChild', 'firstChild'] }
```

### Attribute Slot
For attribute interpolation: `<div class="btn ${cls}" onclick=${handler}>`
```typescript
{
    type: 'attributes',
    path: ['firstElementChild'],
    attributes: {
        names: ['class', 'onclick'],
        statics: { class: 'btn ' }
    }
}
```

## Implementation Phases

### Phase 1: Extend ts-parser.ts
- [ ] Track nesting depth during AST traversal
- [ ] Link child templates to parent
- [ ] Return flat list sorted by depth (deepest first for hoisting)

### Phase 2: Update codegen.ts - COMPLETED
- [x] Import `parse` from `parser.ts`
- [x] Use `attributes.statics` for pre-joined static values
- [x] Use `attributes.names` to correlate expressions

### Phase 3: Delete old parser.ts - COMPLETED
- [x] Delete old complex `parser.ts`
- [x] Renamed `_parser.ts` to `parser.ts`

---

# Compiler Optimizations

## 1. Attribute Handler Specialization - COMPLETED

**Status**: Implemented in codegen.ts

| Attribute | Handler | Optimization |
|-----------|---------|--------------|
| `class` | `__setClass` | Uses `className`, handles arrays |
| `class` + static | `__setClassPreparsed` | Pre-joined static base |
| `style` | `__setStyle` | Uses `setAttribute('style')` |
| `style` + static | `__setStylePreparsed` | Pre-joined static base |
| `data-*` | `__setData` | Uses `setAttribute` |
| `on*` | Route by event type | See Event Routing below |
| `value`, `checked`, etc. | `__setProperty` | Direct property assignment |

**Codegen** (generateAttributeBinding):
```typescript
if (name === 'class') {
    if (staticValue) {
        return `__setClassPreparsed(${el}, ${JSON.stringify(staticValue)}, ${expr});`;
    }
    return `__setClass(${el}, ${expr});`;
}
```

## 2. Event Handler Routing - COMPLETED

**Status**: Implemented in codegen.ts

Uses constants from `~/event/constants.ts`:
- `DIRECT_ATTACH_EVENTS`: blur, focus, scroll, load, play, pause, etc.
- `LIFECYCLE_EVENTS`: onconnect, ondisconnect, onrender, onresize, ontick

**Codegen Output**:
```typescript
__event.delegate(el, 'click', handler);    // Standard - uses event delegation
__event.direct(el, 'focus', handler);      // Non-bubbling - direct attachment
__event.onconnect(el, handler);            // Lifecycle - special handling
```

## 3. Slot Type Pre-Wiring - PARTIAL

**Current**: Effect detection works via `isEffectExpression()`
**Missing**: Full type inference for arrays, html templates, literals

| Expression Type | Handler | Status |
|-----------------|---------|--------|
| Arrow/function | `new EffectSlot()` | Working |
| Array literal | `new ArraySlot()` | Not implemented |
| `html\`...\`` | Direct append | Not implemented |
| String/number literal | `textContent =` | Not implemented |
| Variable with known type | Appropriate handler | Needs TypeChecker fix |

## 4. TypeChecker Integration - PENDING

**Problem**: Currently uses string-based expression analysis
**Solution**: Pass original `ts.Expression` nodes through pipeline

**Implementation**:
- [ ] Pass original `ts.Expression` nodes through pipeline
- [ ] Remove `parseExpression()` string-based approach
- [ ] Use `checker.getTypeAtLocation(expr)` on real nodes

## 5. Spread Unpacking - PARTIAL

**Working**: Object literals are unpacked
**Missing**: Typed variables

**Implementation**:
- [ ] Use TypeChecker to get type of spread expression
- [ ] Extract property names from type
- [ ] Generate unpacked bindings

## 6. Nested Template Hoisting - NOT STARTED

**Goal**: Hoist nested templates to module scope

```typescript
// Input
items.map(i => html`<li>${i}</li>`)

// Output
const __nested_0 = __fragment('<li><!--$--></li>');
items.map(i => { let _r = __nested_0(); __slot(_r.firstChild, i); return _r; })
```

**Implementation**:
- [ ] ts-parser detects nested templates via AST depth
- [ ] Sort by depth (deepest first)
- [ ] Hoist deepest templates first
- [ ] Replace usage with factory reference

## 7. Path Optimization (Ancestor Caching) - SIMPLIFIED

**Status**: Basic path traversal implemented
**Note**: New NodePath format uses string array `['firstChild', 'nextSibling']`

Current implementation generates:
```typescript
let _root = __tmpl_0(),
    _e0 = _root.firstElementChild,
    _e1 = _root.firstElementChild.firstChild;
```

Future optimization could cache shared ancestors, but current approach is functional.

---

## Priority Order (Updated)

1. ~~**Parser Simplification**~~ - DONE
2. ~~**Attribute Handler Specialization**~~ - DONE
3. ~~**Event Handler Routing**~~ - DONE
4. **TypeChecker Integration** - Next priority
5. **Slot Type Pre-Wiring (full)** - Depends on #4
6. **Spread Unpacking (full)** - Depends on #4
7. **Nested Template Hoisting** - Independent, can parallelize
8. **Path Ancestor Caching** - Nice to have

## Validation

- [x] Vite plugin files compile (`pnpm tsc --noEmit` - no errors in vite-plugin/)
- [x] New parser integrated with codegen
- [x] Event routing uses specialized handlers
- [x] Attribute specialization with static values
- [ ] Runtime testing needed
