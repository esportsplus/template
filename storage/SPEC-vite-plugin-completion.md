# Vite Plugin Completion Spec

## Executive Summary

Analysis of `src/vite-plugin/` reveals 6 unfinished features across template compilation. The most impactful is **mixed attribute splitting** (Issue 10) which currently generates runtime template literals instead of pre-splitting static/dynamic parts.

## Unfinished Features

### 1. Mixed Attribute Multiple Interpolations (Issue 10)

**File**: [codegen.ts:710](src/vite-plugin/codegen.ts#L710)

**Current State**: Only single interpolation supported
```typescript
// Multiple interpolations not supported yet, fall back to first
return `\`${parts[0]}\${${valueExpr}}${parts[1] || ''}\``;
```

**Problem**: Template like `class="a ${x} b ${y} c"` loses second dynamic value

**Required**:
- [ ] Track multiple slot indices per mixed attribute
- [ ] Generate template literal with all interpolations: `` `${parts[0]}${v0}${parts[1]}${v1}${parts[2]}` ``
- [ ] Update `extractMixedAttributes()` to return array of indices per attribute
- [ ] Update `MixedAttribute` type: `indices: number[]` instead of `index: number`

**Runtime Impact**: Enables complex class/style bindings without runtime concatenation

---

### 2. Mixed Attribute Static/Dynamic Splitting (Issue 10 - User Request)

**File**: [attributes.ts:483-552](src/attributes.ts#L483-L552)

**Current State**: `setClassPreparsed` and `setStylePreparsed` exist but don't fully separate static from dynamic

**Problem**: Static parts are joined at runtime:
```typescript
let staticClass = staticParts.join(' ');  // Runtime join
```

**Required**:
- [ ] Pre-join static parts at compile time in codegen
- [ ] Pass single static string + dynamic value to runtime
- [ ] New signature: `setClassPreparsed(element, staticBase: string, dynamicValue)`
- [ ] Avoid runtime `join()` call entirely

**Codegen Change**:
```typescript
// Before
__setClassPreparsed(el, ["btn ", " active"], value);

// After
__setClassPreparsed(el, "btn  active", value);
```

---

### 3. Event Handler Compile-Time Routing (Issue 15 - Missing)

**File**: [codegen.ts:805-806](src/vite-plugin/codegen.ts#L805-L806)

**Current State**: All events use `__event()` which routes at runtime

**Available Constants**: [event/constants.ts](src/event/constants.ts)
- `DIRECT_ATTACH_EVENTS`: blur, focus, scroll, etc.
- `LIFECYCLE_EVENTS`: onconnect, ondisconnect, onrender, onresize, ontick

**Required**:
- [ ] Import constants in codegen
- [ ] Route to `__event.direct()` for DIRECT_ATTACH_EVENTS
- [ ] Route to `__event.onconnect()` etc. for LIFECYCLE_EVENTS
- [ ] Route to `__event.delegate()` for standard events

**Codegen Output**:
```typescript
// Current
__event(el, 'click', handler);
__event(el, 'focus', handler);
__event(el, 'onconnect', handler);

// After
__event.delegate(el, 'click', handler);
__event.direct(el, 'focus', handler);
__event.onconnect(el, handler);
```

---

### 4. Nested Template Hoisting Stub (Issue 9)

**File**: [codegen.ts:182-198](src/vite-plugin/codegen.ts#L182-L198)

**Current State**: Function exists but returns empty hoisted array
```typescript
function hoistNestedTemplates(...) {
    let hoisted: string[] = [];
    // ... only sets hoistedId, doesn't generate code
    return { code, hoistedCode: hoisted };  // Always empty
}
```

**Required**:
- [ ] Detect nested templates in value expressions
- [ ] Extract and hoist to module scope
- [ ] Replace inline with reference to hoisted factory
- [ ] Handle deeply nested templates recursively

**Example**:
```typescript
// Input
items.map(i => html`<li>${i}</li>`)

// Output (hoisted)
const __nested_0 = __fragment('<li><!--$--></li>');

// Usage
items.map(i => { let _r = __nested_0(); __slot(_r.firstChild, i); return _r; })
```

---

### 5. Slot Type Pre-Wiring (Issue 14 - Partial)

**File**: [ts-type-analyzer.ts:83-221](src/vite-plugin/ts-type-analyzer.ts#L83-L221)

**Current State**: `inferSlotType()` exists but only used for effect detection

**Available Types**:
```typescript
type SlotType = 'array-slot' | 'document-fragment' | 'effect' | 'node' | 'primitive' | 'static' | 'unknown';
```

**Required**:
- [ ] Use `SlotType` to select runtime slot handler at compile time
- [ ] Generate `new ArraySlot()` directly for array types
- [ ] Generate text node operations for primitives
- [ ] Skip slot wrapper for static values

**Codegen Optimization**:
```typescript
// Current (all use generic slot)
__slot(el, value);

// After (type-aware)
new ArraySlot(el, arrayValue);           // array-slot
el.appendChild(fragmentValue);            // document-fragment
new EffectSlot(el, effectFn);            // effect
el.textContent = primitiveValue;          // primitive
// static values applied at build time, no runtime code
```

---

### 6. TypeChecker Integration for Variables (Issue 14 - Partial)

**File**: [ts-type-analyzer.ts:161-218](src/vite-plugin/ts-type-analyzer.ts#L161-L218)

**Current State**: TypeChecker lookup exists but operates on synthetic AST
```typescript
// Note: The parsed expression is from a synthetic file, so TypeChecker
// cannot resolve external references.
```

**Problem**: Variable type inference fails because expressions are re-parsed in isolation

**Required**:
- [ ] Pass original source file node to type analyzer
- [ ] Use actual AST nodes instead of re-parsing expression strings
- [ ] Preserve type information from original compilation context

---

## Implementation Order

1. **Mixed Attribute Static Splitting** (Issue 10 enhancement) - Low risk, high value
2. **Event Handler Routing** (Issue 15) - Low risk, removes runtime branching
3. **Multiple Interpolations** (Issue 10) - Medium risk, enables complex bindings
4. **Slot Type Pre-Wiring** (Issue 14) - Medium risk, significant perf gain
5. **Nested Template Hoisting** (Issue 9) - Higher risk, requires careful testing
6. **TypeChecker Integration** (Issue 14 enhancement) - Highest complexity

## Metrics

- Files analyzed: 6
- Unfinished features: 6
- Stub functions: 1 (hoistNestedTemplates)
- Partial implementations: 4
- Missing features: 1 (event routing)

## Validation Checklist

After each implementation:
- [ ] `pnpm tsc --noEmit` passes
- [ ] Compiled output matches expected codegen
- [ ] Runtime behavior unchanged for existing templates
- [ ] New edge cases covered
