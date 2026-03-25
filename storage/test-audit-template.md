# Test Audit: @esportsplus/template

**Date:** 2026-03-24
**Version:** 0.17.1

## Summary

| Metric | Value |
|--------|-------|
| Source modules | 26 |
| Test files | 23 |
| Total tests | 483 (all passing) |
| Benchmark files | 1 (8 benchmark groups) |
| Statement coverage | 84.25% |
| Branch coverage | 75.99% |
| Function coverage | 87.68% |
| Line coverage | 84.29% |

## Coverage by Module

| File | Stmts | Branch | Funcs | Lines | Status |
|------|-------|--------|-------|-------|--------|
| src/constants.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/hmr.ts | 100% | 90.9% | 100% | 100% | COMPLETE |
| src/html.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/render.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/svg.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/utilities.ts | 100% | 88.9% | 100% | 100% | COMPLETE |
| src/event/onconnect.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/event/onresize.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/event/ontick.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/slot/cleanup.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/slot/index.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/slot/render.ts | 96.4% | 95.2% | 100% | 96.2% | COMPLETE |
| src/compiler/constants.ts | 100% | 100% | 100% | 100% | COMPLETE |
| src/compiler/parser.ts | 97.4% | 91.2% | 100% | 97.2% | COMPLETE |
| src/compiler/ts-parser.ts | 100% | 89.7% | 100% | 100% | COMPLETE |
| src/event/index.ts | 87.8% | 75% | 78.6% | 87% | GAPS |
| src/slot/array.ts | 92.4% | 79.3% | 89.3% | 92.1% | GAPS |
| src/slot/effect.ts | 84.7% | 76.3% | 80% | 86.2% | GAPS |
| src/compiler/codegen.ts | 83.8% | 67.5% | 100% | 82.9% | GAPS |
| src/attributes.ts | 72.3% | 70.6% | 81.8% | 72.6% | GAPS |
| src/compiler/ts-analyzer.ts | 64.7% | 74.5% | 50% | 68.8% | GAPS |
| src/compiler/plugins/vite.ts | 34.8% | 27.3% | 33.3% | 34.8% | LOW |
| src/compiler/index.ts | 0% | 0% | 0% | 0% | UNTESTED |
| src/compiler/plugins/tsc.ts | 0% | 0% | 0% | 0% | UNTESTED |
| src/index.ts | 0% | 0% | 100% | 0% | RE-EXPORT |
| src/types.ts | 0% | 0% | 0% | 0% | TYPE-ONLY |

## Missing Tests (Priority Order)

| Module | Export | Type | Risk | Details |
|--------|--------|------|------|---------|
| src/compiler/index.ts | default (transform) | function | HIGH | Entire compiler plugin coordination — pattern matching, reactive call replacement, template prepending, import injection. Zero coverage. |
| src/attributes.ts | list() internal | function | HIGH | Dynamic class/style removal, hydration state branching (STATE_HYDRATING vs STATE_WAITING), schedule() path. Lines 100-235 uncovered. |
| src/compiler/codegen.ts | generateAttributeBinding() | function | HIGH | Object literal expansion — spread properties, computed names, shorthand properties, method declarations. Lines 220-307 uncovered. |
| src/compiler/ts-analyzer.ts | isTypeFunction() | function | HIGH | Union type recursion, type checker integration for identifiers/property access/call expressions. Lines 8-18, 74, 78-80 uncovered. |
| src/compiler/plugins/vite.ts | transform() | method | MEDIUM | Plugin wrapper transform — dev mode check, HMR injection integration, no-match passthrough. Lines 33-45, 63-75 uncovered. |
| src/event/index.ts | register() internal | function | MEDIUM | Multi-listener AbortController cleanup, ondisconnect decrement logic. Lines 50-55 uncovered. |
| src/event/index.ts | delegate() | function | MEDIUM | currentTarget property override getter (node \|\| document fallback). Line 73 uncovered. |
| src/event/index.ts | on() | function | MEDIUM | Direct listener cleanup on element disconnect. Line 104 uncovered. |
| src/slot/effect.ts | EffectSlot.effect() | method | MEDIUM | RAF scheduled update path when disposer exists. Lines 48-54 uncovered. |
| src/slot/effect.ts | EffectSlot.dispose() | method | MEDIUM | Group head reset when textnode absent. Lines 71-73 uncovered. |
| src/slot/effect.ts | EffectSlot.update() | method | LOW | Textnode reconnection when disconnected from DOM. Line 102 uncovered. |
| src/slot/array.ts | ArraySlot sync | method | LOW | Sort with order length mismatch — full resync fallback. Lines 246-249 uncovered. |
| src/attributes.ts | setProperties() | function | LOW | Event handler routing via `on` prefix detection. Lines 299-303 uncovered. |
| src/compiler/codegen.ts | generateCode() | function | LOW | Empty path slot skip, duplicate node lookup cache. Lines 171, 177 uncovered. |

## Shallow Tests

| Module | Export | Covered | Missing Edge Cases |
|--------|--------|---------|--------------------|
| src/slot/array.ts | ArraySlot | push/pop/shift/unshift/splice/sort/reverse/clear/concat/set | Sort with mismatched order length, sync() without moveBefore parent |
| src/slot/effect.ts | EffectSlot | primitives, objects, nested functions, dispose | Batched RAF updates (scheduled path), dispose with group but no textnode, text node reattachment |
| src/attributes.ts | setList | basic class/style add | Removal of stale attributes (cold !== undefined), state-dependent hydration branching |
| src/attributes.ts | setProperties | static/dynamic props | Event handler detection via `on` prefix in properties object |
| src/event/index.ts | delegate | basic delegation, bubbling | currentTarget getter fallback, multi-listener AbortController lifecycle |
| src/compiler/ts-parser.ts | findHtmlTemplates | basic/nested/multiple | Branch: template without substitutions (line 26), empty parts (line 52), non-matching tag (line 79) |
| src/utilities.ts | fragment | HTML parsing, caching | Branch: empty string optimization (line 9) |

## Missing Benchmarks

| Module | Export | Reason |
|--------|--------|--------|
| src/compiler/codegen.ts | generateCode() | Hot path in build pipeline — measures compilation throughput |
| src/compiler/parser.ts | parse() | Hot path in build pipeline — template parsing speed |
| src/slot/effect.ts | EffectSlot.update() | Called on every reactive change — render loop critical path |
| src/attributes.ts | list() / setProperty() | Called per-attribute per-render — DOM mutation hot path |

**Existing benchmarks cover:** attribute apply, class list rebuild, event defineProperty, marker clone, ontick iteration, fragment append, array sort sync, fragment dedup. All passing.

## Stale Tests

No stale tests detected. All 483 tests reference current exports.

## Untestable / Low-Value Coverage

| Module | Reason |
|--------|--------|
| src/types.ts | Type-only file, no runtime code |
| src/index.ts | Re-export barrel, lines 5-7 are import/export statements |
| src/compiler/plugins/tsc.ts | Single-line wrapper: `export default plugin.tsc([reactivity, template])` — requires full tsc plugin infrastructure |

## Recommendations

### Priority 1 — High-Risk Gaps

1. **src/compiler/index.ts** — Write integration tests for the full transform pipeline. The existing `tests/compiler/integration.ts` tests the *internal* pipeline function but not the plugin entry point. Test: pattern matching for `html\`` calls, reactive call replacement, import injection, result assembly.

2. **src/attributes.ts list()** — Add tests for dynamic attribute removal (class/style values disappearing between renders), hydration state transitions, and the schedule() batching path.

3. **src/compiler/codegen.ts generateAttributeBinding()** — Test object literal expansion with spread properties (should fall back to setProperties), computed property names, shorthand properties, and method declarations.

4. **src/compiler/ts-analyzer.ts isTypeFunction()** — Test union types containing mixed function/non-function members, and the type checker integration path with identifiers and call expressions.

### Priority 2 — Medium-Risk Gaps

5. **src/compiler/plugins/vite.ts transform()** — Test the plugin wrapper's transform method: production mode (skip HMR), no-template-match passthrough, and full HMR injection path.

6. **src/event/index.ts** — Test multi-listener AbortController cleanup (decrement to 0), currentTarget getter fallback, and direct listener ondisconnect cleanup.

7. **src/slot/effect.ts** — Test RAF scheduled update batching, dispose with group but no textnode, and disconnected textnode reattachment.

### Priority 3 — Low-Risk / Hardening

8. **src/slot/array.ts** — Test sort with mismatched order array length (triggers full resync).

9. **Missing benchmarks** — Add benchmarks for codegen, parser, EffectSlot.update(), and attribute mutation hot paths.

10. **Coverage thresholds** — Consider adding to vitest.config.ts:
    ```typescript
    thresholds: {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85,
    }
    ```
