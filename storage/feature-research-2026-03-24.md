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