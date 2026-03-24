# Feature Research — @esportsplus/template

**Date:** 2026-03-24
**Method:** Parallel web research agents covering modern framework features, DOM APIs, compiler/DX improvements
**Scope:** Runtime features, compiler enhancements, developer experience, new browser APIs

---

## Current Library Capabilities

- Compile-time `html` tagged template literal → optimized DOM construction
- `svg` tagged template support with SVG sprite helper
- Reactive slots: `EffectSlot` (single values), `ArraySlot` (lists with fine-grained ops)
- Event delegation (document-level) + direct attachment for non-bubbling events
- Lifecycle events: `onconnect`, `ondisconnect`, `onrender`, `onresize`, `ontick`
- Attribute system with batched RAF updates, class/style list merging
- Cleanup system via symbol-keyed arrays on nodes
- Vite plugin + TypeScript transformer

---

## Feature Findings

### F3: Suspense / Async Content Boundaries

**What:** Declarative async content handling — show fallback UI while async data loads, then swap in real content. Nested suspense boundaries enable progressive rendering.

**How frameworks implement:**
- React: `<Suspense fallback={<Loading/>}>`
- SolidJS 2.0: `<Loading>` boundary with `isPending()` — distinguishes initial load from revalidation
- Svelte: `{#await promise}...{:then data}...{:catch error}...{/await}`
- Qwik: Automatic suspense via resumability

**Why useful:**
- Async data fetching is universal; every app needs loading states
- Nested boundaries prevent full-page loading spinners
- Streaming SSR: flush boundary fallbacks, then stream resolved content
- SolidJS 2.0's `isPending()` avoids tearing — query if async work is in flight without demolishing UI

**Proposed API:**
```typescript
// Compile-time: detect async effects, wrap in boundary
html`<div>${async () => {
    let data = await fetch('/api');
    return html`<span>${data.name}</span>`;
}}</div>`;

// Runtime: AsyncSlot that renders fallback, then swaps to resolved content
```

**Applicability:** Medium — requires new `AsyncSlot` type. Compile-time could detect async arrow functions and emit boundary code. Runtime needs promise tracking + fallback rendering.

**Complexity:** Medium-High
**Priority:** Medium

---


### F6: `moveBefore()` DOM API

**What:** New DOM method (`parentNode.moveBefore(node, referenceNode)`) for moving nodes within the DOM without triggering disconnect/reconnect lifecycle callbacks. Preserves iframe state, CSS animations, focus, form data, `<video>` playback.

**Browser support:** Chrome 133+, Firefox 144+, Edge 133+. Safari: not yet.

**Why useful:**
- Array sort/reverse currently detaches all nodes into fragment, then reattaches
- This triggers `disconnectedCallback` + `connectedCallback` for every node
- Destroys iframe content, CSS animations, focus state, video playback
- `moveBefore` preserves all of these — just repositions in the tree

**Proposed integration:**
```typescript
// In ArraySlot.sort() / ArraySlot.sync():
if ('moveBefore' in this.marker.parentNode!) {
    // Use moveBefore for each node
    ref.parentNode!.moveBefore(node, ref.nextSibling);
}
else {
    // Fallback: existing fragment-based approach
}
```

**Applicability:** High — direct drop-in for `ArraySlot.sort()` and `ArraySlot.sync()`. The LIS algorithm (already implemented) determines which nodes to move; `moveBefore` makes those moves non-destructive.

**Complexity:** Low
**Priority:** High (when Safari ships support)

---

### F7: Two-Way Binding / Form Handling

**What:** Syntactic sugar for binding form input values to reactive signals with automatic synchronization.

**How frameworks implement:**
- Vue: `v-model` directive (compiles to value binding + input event)
- Svelte: `bind:value`, `bind:checked`, `bind:group`
- SolidJS: No built-in two-way binding (explicit event handlers)
- Angular: `[(ngModel)]` with FormsModule

**Why useful:**
- Forms are the most common interactive pattern
- Manual `oninput` + signal write is boilerplate
- Checkbox groups, radio groups, select multiples need special handling
- Validation interception (transform before write)

**Proposed API:**
```typescript
// Compile-time: detect reactive value in value/checked position
html`<input value=${signal} />`  // auto-bind: set value + listen for input event

// Or explicit:
html`<input bind:value=${signal} />`
```

**Compile-time detection:** If `value` attribute is an `Effect` (reactive function) on an `<input>`, emit both the attribute binding AND an `input` event listener that writes back to the signal.

**Applicability:** High — compile-time system can detect input elements + reactive attributes and emit two-way binding code.

**Complexity:** Medium (many edge cases: select, textarea, checkbox, radio, contenteditable)
**Priority:** Medium-High

---

### F8: Ref / Element Access Pattern

**What:** A way to get a reference to the actual DOM element after rendering, for use in imperative DOM manipulation, measurements, third-party library integration.

**How frameworks implement:**
- React: `useRef()` + `ref={myRef}`
- SolidJS: `let el; <div ref={el}>`
- Vue: `ref="myRef"` template attribute
- Lit: `@query('#selector')` decorator

**Why useful:**
- Canvas/WebGL integration needs element reference
- Third-party library init (charts, maps, editors)
- Measurements (getBoundingClientRect)
- Focus management
- Animation libraries (GSAP, Motion One)

**Current library state:** The `onconnect` lifecycle event already provides element reference:
```typescript
html`<div onconnect=${(el) => { /* have reference */ }}>...</div>`
```

This is already a ref mechanism. A dedicated `ref` API would be sugar for this pattern.

**Proposed API:**
```typescript
// Callback ref (already supported via onconnect)
html`<div onconnect=${(el) => { canvasRef = el; }}>...</div>`

// Signal ref (new — populate signal with element)
let el = signal<HTMLDivElement | null>(null);
html`<div ref=${el}>...</div>`
// Compile-time: emit `onconnect` that writes to signal + `ondisconnect` that nulls it
```

**Applicability:** Low-Medium — `onconnect` already covers the core use case. Signal ref is just syntactic sugar.

**Complexity:** Low
**Priority:** Low

---

### F9: Keyed List Rendering

**What:** Explicit key association for list items to ensure correct reconciliation when items are reordered, inserted, or removed. Without keys, positional identity is used (item at index 0 is always the "first" item).

**Why useful:**
- Reordering without keys: animations break, form state lost, components remount
- With keys: framework knows "item A moved from position 2 to 0" — can reuse existing DOM
- Critical for: sortable lists, drag-and-drop, filtered lists, paginated data

**Current library state:** `ArraySlot` uses `html.reactive(array, template)` — the template function receives the value. There's no explicit key mechanism; the array index IS the identity (positional).

**How frameworks handle it:**
- React: `key` prop on JSX elements
- SolidJS: `<For each={items}>{(item) => ...}</For>` — items tracked by reference
- Svelte: `{#each items as item (item.id)}` — parenthetical key expression
- Lit: `repeat(items, item => item.id, (item) => html\`...\`)` directive

**Proposed API:**
```typescript
// Key function as third argument to html.reactive:
html.reactive(array, (item) => html`<div>${item.name}</div>`, (item) => item.id);

// Compile-time: emit ArraySlot with key-based reconciliation
```

**Applicability:** High — the ArraySlot already has `splice`, `set`, `sort` operations. Adding key-based identity would improve reconciliation when the array is replaced entirely (vs mutated). Compile-time can detect the key function and emit optimal diff code.

**Complexity:** Medium-High (key-based diff algorithm, handling key collisions, mapping old→new)
**Priority:** High

---

### F10: Streaming SSR + Hydration

**What:** Server-side rendering that streams HTML chunks as they become ready, with client-side hydration that reuses the server-rendered DOM instead of re-creating it.

**How frameworks implement:**
- React 18: `renderToReadableStream()` + Suspense boundaries for streaming
- SolidJS: `renderToStream()` with island deduplication
- Lit: `@lit-labs/ssr` with Declarative Shadow DOM
- Qwik: Resumability — no hydration needed, just resume from serialized state

**Why useful:**
- TTFB improvement: stream first content immediately
- Progressive rendering: show above-the-fold content while below-fold loads
- SEO: search engines crawl the streamed HTML
- Performance: reuse server DOM instead of re-creating

**Key components needed:**
1. **Template serializer:** Convert compiled template to HTML string (server-side)
2. **Hydration runtime:** Walk existing DOM, attach event handlers, connect reactivity
3. **Marker reconciliation:** Match server-rendered markers to slot positions
4. **Streaming boundaries:** `Suspense`-like boundaries for progressive flush

**Applicability:** Medium — the compile-time system knows template structure. A server-side codegen target could emit `renderToString()` instead of DOM construction. Hydration would walk the existing DOM using the same paths the runtime uses.

**Complexity:** High
**Priority:** Medium (for full-stack applications)

---

### F11: HMR (Hot Module Replacement) for Templates

**What:** Fine-grained hot reloading during development — when a template changes, only that template's DOM updates without full page reload.

**How frameworks implement:**
- Vite: Module-level HMR via `import.meta.hot.accept()`
- Svelte: Component-level HMR preserving state
- Vue: Template-only HMR (script state preserved)
- SolidJS + Vite: Component-boundary HMR

**Why useful:**
- Faster development iteration
- Preserves app state during UI changes
- Instant visual feedback

**Current library state:** The Vite plugin (`compiler/plugins/vite.ts`) transforms templates at build time. No HMR handling exists.

**Proposed integration:**
- Vite plugin emits `import.meta.hot.accept()` for modules with `html` templates
- On update: re-run template factory, diff against existing DOM, patch
- Preserve reactive bindings across hot updates

**Applicability:** High — Vite plugin is already the entry point. Adding HMR is a natural extension.

**Complexity:** Medium
**Priority:** High (developer experience)

---

### F12: Declarative Shadow DOM

**What:** HTML attribute `shadowrootmode="open|closed"` on `<template>` elements creates shadow roots during HTML parsing — no JavaScript needed for initial render.

**Browser support:** Chrome 111+, Firefox 125+, Safari 16.4+

**Why useful:**
- SSR'd Web Components render with encapsulation immediately (no FOUC)
- No JavaScript needed for initial shadow DOM creation
- Works with streaming SSR
- `adoptedStyleSheets` share styles across shadow roots efficiently

**Proposed integration:**
```typescript
// Compile-time: detect shadow root directive
html`<my-component>
    <template shadowrootmode="open">
        <style>${styles}</style>
        <slot></slot>
    </template>
</my-component>`
```

**Applicability:** Medium — useful for Web Component authoring. Compile-time could emit Declarative Shadow DOM for SSR, then hydrate on client.

**Complexity:** Medium
**Priority:** Low-Medium (niche — Web Component authors)

---

### F13: Incremental Compilation

**What:** Only re-compile templates that changed since last build, using cached AST data.

**How frameworks implement:**
- TypeScript: `.tsbuildinfo` for incremental builds
- Vite: Module dependency graph + timestamp checking
- esbuild: Content hash comparison

**Why useful:**
- Large projects with 100+ templates: full recompilation is slow
- Dev builds benefit most — save seconds per change
- CI builds: cache compilation artifacts between runs

**Proposed implementation:**
- Store template hashes + compiled output in `.tsbuildinfo`-style cache
- On build: compare template string hash, skip unchanged
- Vite plugin: leverage Vite's module graph for dependency tracking

**Applicability:** Medium — more valuable as the library is adopted in larger projects.

**Complexity:** Medium
**Priority:** Medium (scales with project size)

---

## Priority Matrix

### Tier 1 — High Value, Practical to Implement

| # | Feature | Complexity | Notes |
|---|---------|------------|-------|
| F6 | `moveBefore()` API | Low | Drop-in for ArraySlot sort/sync |
| F9 | Keyed list rendering | Medium-High | Correctness requirement for real apps |
| F11 | HMR for templates | Medium | Critical DX improvement |

### Tier 2 — High Value, Higher Effort

| # | Feature | Complexity | Notes |
|---|---------|------------|-------|
| F2 | Enter/exit animations | Medium | Needs deferred removal |
| F3 | Suspense / Async boundaries | Medium-High | New slot type |
| F4 | Error boundaries | Low-Medium | Try/catch wrapper |
| F7 | Two-way binding | Medium | Many input type edge cases |

### Tier 3 — Nice to Have

| # | Feature | Complexity | Notes |
|---|---------|------------|-------|
| F1 | View Transitions API | Low-Medium | Wrapper around browser API |
| F5 | Popover API integration | Low | Attribute detection + events |
| F8 | Ref / element access | Low | `onconnect` already covers this |
| F12 | Declarative Shadow DOM | Medium | Niche use case |
| F13 | Incremental compilation | Medium | Scales with adoption |

### Tier 4 — Strategic / Long-term

| # | Feature | Complexity | Notes |
|---|---------|------------|-------|
| F10 | Streaming SSR + Hydration | High | Full-stack requirement |

---

## Recommended Implementation Order

1. **F6: `moveBefore()`** — Low complexity, improves ArraySlot sort/reverse
2. **F4: Error boundaries** — Low-medium complexity, production necessity
3. **F9: Keyed lists** — Medium-high complexity, correctness requirement
4. **F7: Two-way binding** — Medium complexity, form-heavy apps
5. **F2: Enter/exit animations** — Medium complexity, visual polish
6. **F11: HMR** — Medium complexity, developer experience
7. **F3: Suspense** — Medium-high complexity, async patterns
8. **F1: View Transitions** — Low complexity but niche, can add anytime

---

## Research Sources

- Lit 3.x documentation (directives, SSR, task management)
- Svelte 5 runes specification (fine-grained reactivity, snippets)
- SolidJS 2.0 RFC (async primitives, streaming dedup, `isPending`)
- Qwik documentation (resumability, symbol extraction)
- Million.js architecture (block virtual DOM)
- MDN: View Transitions API, Popover API, `moveBefore()`, Declarative Shadow DOM
- Chrome DevRel blog: View Transitions (Chrome 111/126), Popover API (Chrome 114)
- TC39 Signals proposal (Stage 1)
- Vite HMR documentation
