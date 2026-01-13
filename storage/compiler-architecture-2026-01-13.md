# Compiler Architecture Documentation

## Compilation Flow Diagram

```
                              ┌─────────────────────────────────────────────────────┐
                              │                   BUILD TOOLS                        │
                              │              (Vite / TypeScript)                     │
                              └─────────────────────┬───────────────────────────────┘
                                                    │
                                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                          @esportsplus/typescript/compiler                                  │
│                                                                                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │   program   │───►│ coordinator │───►│   imports   │───►│     ast     │                │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘                │
│         │                  │                                     │                        │
│         │                  │ Sequential Plugin Execution         │                        │
│         ▼                  ▼                                     ▼                        │
│  ┌─────────────┐    ┌──────────────────────────────────────────────────┐                 │
│  │  ts.Program │    │                  PLUGIN CHAIN                     │                 │
│  │  ts.Checker │    │  ┌────────────┐   ┌────────────┐   ┌────────────┐│                 │
│  └─────────────┘    │  │  Plugin 1  │──►│  Plugin 2  │──►│  Plugin N  ││                 │
│                     │  └────────────┘   └────────────┘   └────────────┘│                 │
│                     └──────────────────────────────────────────────────┘                 │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                     ┌──────────────────────────────┼──────────────────────────────┐
                     │                              │                              │
                     ▼                              ▼                              ▼
┌────────────────────────────────┐  ┌────────────────────────────────┐  ┌────────────────────┐
│  @esportsplus/reactivity       │  │  @esportsplus/frontend         │  │   Custom Plugins   │
│      /compiler                 │  │      /template/compiler        │  │                    │
│                                │  │                                │  │                    │
│  ┌──────────────────────────┐  │  │  ┌──────────────────────────┐  │  │  ┌──────────────┐  │
│  │      index.ts            │  │  │  │      index.ts            │  │  │  │   Your       │  │
│  │  (Plugin Definition)     │  │  │  │  (Plugin Definition)     │  │  │  │   Plugin     │  │
│  └─────────────┬────────────┘  │  │  └─────────────┬────────────┘  │  │  └──────────────┘  │
│                │               │  │                │               │  │                    │
│       ┌───────┴───────┐       │  │       ┌───────┴───────┐       │  │                    │
│       ▼       ▼       ▼       │  │       ▼       ▼       ▼       │  │                    │
│  ┌────────┬────────┬────────┐ │  │  ┌────────┬────────┬────────┐ │  │                    │
│  │primit- │ array  │ object │ │  │  │ parser │codegen │ts-     │ │  │                    │
│  │ives.ts │ .ts    │ .ts    │ │  │  │  .ts   │  .ts   │parser  │ │  │                    │
│  └────────┴────────┴────────┘ │  │  └────────┴────────┴────────┘ │  │                    │
└────────────────────────────────┘  └────────────────────────────────┘  └────────────────────┘
                     │                              │
                     ▼                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TRANSFORMED CODE                                         │
│                                                                                            │
│   Input:  reactive(0)              Input:  html`<div>${name}</div>`                        │
│   Output: _r.signal(0)             Output: (() => { let root = _t(); ... })()             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Package Overview

### 1. @esportsplus/typescript/compiler

**Purpose**: Core compiler infrastructure providing the plugin system, AST utilities, and build tool integrations.

**Location**: `G:/typescript/src/compiler/`

**Exports**:
- `ast` - AST traversal and inspection utilities
- `code` - Code generation template tag
- `coordinator` - Sequential plugin execution engine
- `imports` - Import analysis and manipulation
- `plugin` - Plugin factory for Vite/TSC
- `uid` - Unique identifier generator

#### Key Components

##### coordinator.ts
The heart of the compilation system. Transforms source code through plugins sequentially:

1. **Pattern Matching**: Fast-path skip if source doesn't contain plugin patterns
2. **Plugin Execution**: Each plugin receives fresh AST with accurate positions
3. **Intent Application**: Applies replacements, prepends, and import modifications
4. **Program Rebuild**: Creates updated TypeScript program after each plugin for accurate type checking

```typescript
// Core transformation flow
const transform = (plugins, code, file, program, shared) => {
    for (let plugin of plugins) {
        if (plugin.patterns && !hasPattern(code, plugin.patterns)) continue;

        let { imports, prepend, replacements } = plugin.transform({
            checker: program.getTypeChecker(),
            code, program, shared, sourceFile
        });

        // Apply changes and rebuild program
    }
}
```

##### imports.ts
Tracks and manipulates import statements:
- `all(file, pkg)` - Find all imports from a package
- `includes(checker, node, pkg, symbolName?)` - Check if a symbol originates from a package (handles re-exports)
- Uses WeakMap caching for performance

##### ast.ts
AST utilities:
- `expression.name(node)` - Extract identifier or property path
- `inRange(ranges, start, end)` - Check if position falls within ranges
- `property.path(node)` - Build dot-separated property path
- `test(node, fn)` - Recursive predicate testing

##### program.ts
TypeScript program management:
- Creates and caches `ts.Program` instances per project root
- Reads `tsconfig.json` for compiler options
- Provides type checker for semantic analysis

##### uid.ts
Generates collision-free identifiers:
- Format: `{prefix}_{uuid}{counter}`
- Used for generated class names, variable names, template IDs

#### Plugin Interface

```typescript
type Plugin = {
    patterns?: string[];  // Quick-check strings (e.g., ['reactive(', 'html`'])
    transform: (ctx: TransformContext) => TransformResult;
};

type TransformContext = {
    checker: ts.TypeChecker;  // Type information
    code: string;             // Current source
    program: ts.Program;      // Full program
    shared: SharedContext;    // Cross-plugin state
    sourceFile: ts.SourceFile;
};

type TransformResult = {
    imports?: ImportIntent[];      // Import modifications
    prepend?: string[];            // Code after imports
    replacements?: ReplacementIntent[];  // AST node replacements
};
```

---

### 2. @esportsplus/reactivity/compiler

**Purpose**: Transforms `reactive()` calls into optimized signal/computed/reactive-array code.

**Location**: `G:/reactivity/src/compiler/`

**Entry Pattern**: `reactive(`, `reactive<`

#### Transformation Types

| Input | Output | Transform File |
|-------|--------|----------------|
| `reactive(value)` | `_r.signal(value)` | primitives.ts |
| `reactive(() => expr)` | `_r.computed(() => expr)` | primitives.ts |
| `reactive([...])` | `new _r.ReactiveArray(...)` | array.ts |
| `reactive({...})` | `new ReactiveObject_xyz(...)` | object.ts |

#### primitives.ts
Handles scalar reactivity transformations:

1. **Signal Detection**: `reactive(staticValue)` → `_r.signal(staticValue)`
2. **Computed Detection**: `reactive(() => expr)` → `_r.computed(() => expr)`
3. **Read/Write Tracking**: Transforms variable access to `_r.read(x)` and assignments to `_r.write(x, value)`
4. **Compound Operators**: `x += 1` → `_r.write(x, x.value + 1)`
5. **Increment/Decrement**: `x++` → `_r.write(x, x.value + 1)`

```typescript
// Input
let count = reactive(0);
count++;
console.log(count);

// Output
let count = _r.signal(0);
_r.write(count, count.value + 1);
console.log(_r.read(count));
```

#### array.ts
Transforms reactive arrays:

1. **Array Literal Detection**: `reactive([...])` → `new _r.ReactiveArray(...)`
2. **Type Preservation**: Extracts element type from `as` assertions or variable declarations
3. **Length Access**: `.length` → `.$length()` (reactive length)
4. **Index Assignment**: `arr[i] = v` → `arr.$set(i, v)`
5. **Binding Propagation**: Tracks array bindings through variable assignments

```typescript
// Input
let items = reactive([1, 2, 3] as number[]);
items[0] = 10;
console.log(items.length);

// Output
let items = new _r.ReactiveArray<number>(...[1, 2, 3]);
items.$set(0, 10);
console.log(items.$length());
```

#### object.ts
Transforms reactive objects into generated classes:

1. **Class Generation**: Creates optimized class with private signals
2. **Property Analysis**: Determines signal/computed/array type per property
3. **Static Optimization**: Static values (literals) inline directly
4. **Type Hints**: `reactive<Type>({...})` preserves type information

```typescript
// Input
let state = reactive({ count: 0, double: () => state.count * 2 });

// Output
class ReactiveObject_abc<T0, T1 extends _r.Computed<ReturnType<T1>>['fn']> extends _r.ReactiveObject<any> {
    #count;
    #double;

    constructor(_p0: T0, _p1: T1) {
        super(null);
        this.#count = this[_r.SIGNAL](_p0);
        this.#double = this[_r.COMPUTED](_p1);
    }

    get count() { return _r.read(this.#count) as T0; }
    set count(_v0) { _r.write(this.#count, _v0); }
    get double() { return _r.read(this.#double); }
}

let state = new ReactiveObject_abc(0, () => state.count * 2);
```

---

### 3. @esportsplus/frontend/template/compiler

**Purpose**: Compiles tagged HTML templates into optimized DOM creation code.

**Location**: `G:/frontend/src/template/compiler/`

**Entry Pattern**: `` html` ``, `html.reactive`

#### Transformation Pipeline

```
html`<div>${expr}</div>`
         │
         ▼
┌─────────────────┐
│   ts-parser.ts  │  Extract template literals and expressions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    parser.ts    │  Parse HTML, identify slots, build path tree
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ts-analyzer.ts │  Analyze expression types (Effect, Static, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   codegen.ts    │  Generate optimized DOM code
└─────────────────┘
```

#### ts-parser.ts
Extracts template information from AST:
- `findHtmlTemplates(sourceFile)` - Locate all `html\`...\`` expressions
- `findReactiveCalls(sourceFile)` - Locate `html.reactive(array, callback)` calls
- `extractTemplateParts(template)` - Split template into literals and expressions

#### parser.ts
Parses HTML template strings:

1. **Slot Detection**: Identifies `{{$}}` markers for dynamic content
2. **Path Generation**: Creates DOM traversal paths (e.g., `['firstChild', 'nextSibling']`)
3. **Attribute Parsing**: Extracts dynamic attribute bindings
4. **HTML Cleanup**: Removes whitespace, events, empty attributes

```typescript
// Input: <div class="${cls}">${content}</div>
// Output:
{
    html: '<div><!----></div>',  // Cleaned HTML with comment slot
    slots: [
        { type: 'attribute', path: ['firstChild'], attributes: { names: ['class'], static: {} } },
        { type: 'node', path: ['firstChild', 'firstChild'] }
    ]
}
```

#### ts-analyzer.ts
Determines expression types for optimization:

| Expression Type | Result | Optimization |
|-----------------|--------|--------------|
| Arrow/Function | `Effect` | Creates EffectSlot |
| `html\`...\`` | `DocumentFragment` | Direct insert |
| `html.reactive()` | `ArraySlot` | Creates ArraySlot |
| Literal (string/number/bool/null) | `Static` | Direct textContent |
| Template expression | `Primitive` | Runtime slot |
| Conditional | Analyzes branches | Unified handling |

#### codegen.ts
Generates optimized DOM creation code:

1. **Template Factory**: Creates reusable template cloners
2. **Path Variables**: Declares element references via path traversal
3. **Attribute Bindings**: Generates appropriate setters (property, event, class/style list)
4. **Node Bindings**: Creates slots, effects, or direct inserts based on type

```typescript
// Input
html`<div class="${cls}" onclick=${handler}>${name}</div>`

// Output
const _t_abc = _template.template(`<div><!----></div>`);

(() => {
    let root = _t_abc(),
        el_1 = root.firstChild as _template.Element;

    _template.setList(el_1, 'class', cls, _attr_1);
    _template.delegate(el_1, 'click', handler);
    _template.slot(el_1.firstChild as _template.Element, name);

    return root;
})()
```

#### Event Handling
Three event binding strategies:
- **Lifecycle Events** (`oncreate`, `ondestroy`): Direct element callbacks
- **Direct Attach** (`onfocus`, `onblur`, etc.): `addEventListener` directly
- **Delegated** (all others): Event delegation via `delegate()`

---

## Integration Flow

### Vite Integration

```typescript
// vite.config.ts
import reactivityCompiler from '@esportsplus/reactivity/compiler/plugins/vite';
import templateCompiler from '@esportsplus/frontend/template/compiler/plugins/vite';

export default {
    plugins: [
        plugin({
            name: '@esportsplus/frontend',
            plugins: [
                reactivityCompiler,  // First: transform reactive() calls
                templateCompiler     // Second: transform html`` templates
            ]
        })({ root: __dirname })
    ]
}
```

### Execution Order

1. **Vite Transform Hook**: File loaded/changed
2. **Program Resolution**: Get/create TypeScript program
3. **Coordinator**: Execute plugins sequentially
   - **Reactivity Plugin**: Transform `reactive()` → signals/computed
   - **Template Plugin**: Transform `html\`\`` → DOM code
4. **Code Generation**: Apply replacements, prepends, imports
5. **Return**: Transformed code to Vite

### Cross-Plugin Communication

The `SharedContext` (`Map<string, unknown>`) enables plugins to share state:
- Cleared on file watch change
- Scoped per project root

---

## Key Design Decisions

### 1. Sequential Plugin Execution
Each plugin receives a fresh AST with accurate positions after previous plugins' changes. This ensures:
- Correct source positions for replacements
- Valid type checker for semantic analysis
- No position drift from accumulated changes

### 2. Intent-Based Transformations
Plugins return "intents" rather than modified strings:
- `ReplacementIntent`: AST node + generator function
- `ImportIntent`: Package + add/remove specifiers
- Intents resolved at apply-time with current positions

### 3. Pattern-Based Quick Checks
Plugins declare patterns (e.g., `reactive(`) for fast-path skipping:
- Avoids AST parsing when unnecessary
- Simple string indexOf check
- Patterns checked before type analysis

### 4. Type-Aware Transformations
Full TypeScript program enables:
- Symbol origin tracking (handles re-exports)
- Type-based optimization decisions
- Accurate identifier resolution

### 5. Optimized Code Generation
- **Template Factories**: Clone once, reuse many times
- **Path-Based Traversal**: Direct DOM navigation, no queries
- **Event Delegation**: Single listener per event type
- **Static Inlining**: Literal values inlined directly
