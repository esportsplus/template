# Spec: Event Compilation in Vite Plugin

## Overview

Update the vite-plugin compiler to differentiate between lifecycle events, direct-attach DOM events, and delegated DOM events during code generation.

## Current Behavior

All event attributes (`on*`) are compiled identically:

```typescript
// Input
html`<div onconnect=${fn} onclick=${handler} onfocus=${focusFn}></div>`

// Current output
__event(_e0, 'connect', fn);
__event(_e0, 'click', handler);
__event(_e0, 'focus', focusFn);
```

## Required Behavior

### Lifecycle Events (Direct Pass)

Events in `LIFECYCLE_EVENTS` (from `src/event/constants.ts`) map directly to their respective functions:

| Attribute | Compiled Output |
|-----------|-----------------|
| `onconnect` | `__event.onconnect(element, listener)` |
| `ondisconnect` | `__event.ondisconnect(element, listener)` |
| `onrender` | `__event.onrender(element, listener)` |
| `onresize` | `__event.onresize(element, listener)` |
| `ontick` | `__event.ontick(element, listener)` |

### Direct-Attach DOM Events

Events in `DIRECT_ATTACH_EVENTS` (from `src/event/constants.ts`) use `direct` with `on` prefix stripped:

| Attribute | Compiled Output |
|-----------|-----------------|
| `onblur` | `__event.direct(element, 'blur', listener)` |
| `onfocus` | `__event.direct(element, 'focus', listener)` |
| `onscroll` | `__event.direct(element, 'scroll', listener)` |
| `onsubmit` | `__event.direct(element, 'submit', listener)` |
| `onerror` | `__event.direct(element, 'error', listener)` |
| `onload` | `__event.direct(element, 'load', listener)` |
| `onplay` | `__event.direct(element, 'play', listener)` |
| `onpause` | `__event.direct(element, 'pause', listener)` |
| `onended` | `__event.direct(element, 'ended', listener)` |
| `ontimeupdate` | `__event.direct(element, 'timeupdate', listener)` |
| `onreset` | `__event.direct(element, 'reset', listener)` |
| `onfocusin` | `__event.direct(element, 'focusin', listener)` |
| `onfocusout` | `__event.direct(element, 'focusout', listener)` |

### Delegated DOM Events

All other `on*` DOM events use document-level delegation with `on` prefix stripped:

| Attribute | Compiled Output |
|-----------|-----------------|
| `onclick` | `__event.delegate(element, 'click', listener)` |
| `onmousemove` | `__event.delegate(element, 'mousemove', listener)` |
| `onkeydown` | `__event.delegate(element, 'keydown', listener)` |

## Implementation

### File: `src/vite-plugin/codegen.ts`

#### 1. Add Imports

After existing imports (around line 18):

```typescript
import { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS } from '~/event/constants';
```

#### 2. Variable Collision Detection

Add function to detect existing identifiers in module:

```typescript
function findExistingIdentifiers(sourceFile: ts.SourceFile): Set<string> {
    let identifiers = new Set<string>();

    function visit(node: ts.Node) {
        // Variable declarations: let x, const y, var z
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            identifiers.add(node.name.text);
        }
        // Function declarations: function foo() {}
        else if (ts.isFunctionDeclaration(node) && node.name) {
            identifiers.add(node.name.text);
        }
        // Import specifiers: import { foo } from '...'
        else if (ts.isImportSpecifier(node)) {
            identifiers.add((node.propertyName || node.name).text);
        }
        // Default imports: import foo from '...'
        else if (ts.isImportClause(node) && node.name) {
            identifiers.add(node.name.text);
        }
        // Namespace imports: import * as foo from '...'
        else if (ts.isNamespaceImport(node)) {
            identifiers.add(node.name.text);
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return identifiers;
}

function resolveAlias(name: string, existing: Set<string>): string {
    if (!existing.has(name)) {
        return name;
    }

    let counter = 1;

    while (existing.has(`${name}_${counter}`)) {
        counter++;
    }

    return `${name}_${counter}`;
}
```

#### 3. Update Import Generation

Modify `generateImports` to accept collision-resolved aliases:

```typescript
function generateImports(aliases: Record<string, string>): string {
    let eventAlias = aliases['__event'];

    let imports = `import a from '~/attributes';
import event from '~/event';`;

    // ... rest of imports ...

    imports += `
const ${eventAlias} = event;`;

    return imports;
}
```

#### 4. Pass Aliases Through Code Generation

In `generateCode`, detect collisions and pass aliases:

```typescript
let existing = findExistingIdentifiers(sourceFile),
    aliases = {
        '__event': resolveAlias('__event', existing),
        '__slot': resolveAlias('__slot', existing),
        // ... other generated variables
    };
```

#### 5. Update Event Binding Generation

Replace the event handling logic in `generateInlineTemplate` (around line 805-806), using the resolved alias:

```typescript
// Current:
if (slot.isEvent) {
    code.push(`    __event(${elementVar}, '${slot.name?.slice(2)}', ${valueExpr});`);
}

// New (where `ev` is aliases['__event']):
if (slot.isEvent) {
    let name = slot.name!;

    if (LIFECYCLE_EVENTS.has(name)) {
        code.push(`    ${ev}.${name}(${elementVar}, ${valueExpr});`);
    }
    else if (DIRECT_ATTACH_EVENTS.has(name)) {
        code.push(`    ${ev}.direct(${elementVar}, '${name.slice(2)}', ${valueExpr});`);
    }
    else {
        code.push(`    ${ev}.delegate(${elementVar}, '${name.slice(2)}', ${valueExpr});`);
    }
}
```

#### 6. Update Nested Template Event Binding

Apply same logic in `generateNestedTemplateCall` (around line 651), using the resolved alias:

```typescript
// Current:
if (slot.isEvent) {
    code.push(`    __event(${actualVar}, '${slot.name?.slice(2)}', ${valueExpr}),`);
}

// New (where `ev` is aliases['__event']):
if (slot.isEvent) {
    let name = slot.name!;

    if (LIFECYCLE_EVENTS.has(name)) {
        code.push(`    ${ev}.${name}(${actualVar}, ${valueExpr}),`);
    }
    else if (DIRECT_ATTACH_EVENTS.has(name)) {
        code.push(`    ${ev}.direct(${actualVar}, '${name.slice(2)}', ${valueExpr}),`);
    }
    else {
        code.push(`    ${ev}.delegate(${actualVar}, '${name.slice(2)}', ${valueExpr}),`);
    }
}
```

## Examples

### Standard (No Collision)

#### Input

```typescript
html`
    <div
        onconnect=${() => console.log('connected')}
        onclick=${handleClick}
        onfocus=${handleFocus}
        ontick=${(stop) => { if (done) stop(); }}
        onmousemove=${track}
        onscroll=${handleScroll}
    ></div>
`
```

#### Output

```typescript
(() => {
    let _root = __tmpl_0(),
        _e0 = _root.firstElementChild;

    __event.onconnect(_e0, () => console.log('connected'));
    __event.delegate(_e0, 'click', handleClick);
    __event.direct(_e0, 'focus', handleFocus);
    __event.ontick(_e0, (stop) => { if (done) stop(); });
    __event.delegate(_e0, 'mousemove', track);
    __event.direct(_e0, 'scroll', handleScroll);

    return _root;
})()
```

### With Collision

#### Input

```typescript
let __event = 'user variable';

html`<div onclick=${handleClick}></div>`
```

#### Output

```typescript
import event from '~/event';

const __event_1 = event;

let __event = 'user variable';

(() => {
    let _root = __tmpl_0(),
        _e0 = _root.firstElementChild;

    __event_1.delegate(_e0, 'click', handleClick);

    return _root;
})()
```

## Validation

After implementation:

1. Run `pnpm tsc --noEmit` - must pass
2. Verify lifecycle events compile to direct function calls
3. Verify `DIRECT_ATTACH_EVENTS` compile to `__event.direct` with `on` prefix stripped
4. Verify other DOM events compile to `__event.delegate` with `on` prefix stripped
