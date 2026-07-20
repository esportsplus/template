---
type: feature
recommended-model: opus
status: PENDING
depends-on: [none]
files-own: [tests/compiler/selector.ts]
files-shared: [src/compiler/codegen.ts, src/compiler/index.ts, src/compiler/ts-analyzer.ts]
tests: [tests/compiler/selector.ts, tests/compiler/transform.ts, tests/compiler/codegen.ts, tests/compiler/integration.ts]
api-impact: none
priority: P1
---

# Compile-time selector rewrite: `read(x) === key` → `signal.selector(x, key)`

## Rationale

Per-row selection comparisons inside reactive binding arrows (`() => read(sel) === row.id ? 'danger' : ''`) subscribe every row's effect to the selection signal — O(n) fan-out on each selection change. The runtime already ships the O(2) primitive `signal.selector<T>(node: Signal<T>, key: T): boolean` (node_modules/@esportsplus/reactivity/build/system.d.ts:21), its test landed at tests/selector.ts, and bench/krausest/app.ts adopted it by hand. App authors should get this optimization automatically: the build-time template compiler statically detects the selection-comparison shape and rewrites it to the selector primitive, so hand-adoption becomes unnecessary.

## Changes

Template-compiler binding codegen: expressions flowing through the binding rewrite path gain one additional AST-level replacement — a strict-equality (or strict-inequality) comparison between a reactivity `read(...)` call and a key expression, occurring inside a reactive-observer arrow, is emitted as `signal.selector(...)` (negated for `!==`). The compiler analysis module gains the detection predicate; the transform entry gains conditional injection of the `signal` named import from `@esportsplus/reactivity` when at least one rewrite fired. No public API change — output-shape change only, behavior-preserving.

## Design

Settled decisions (Mode 4 — file-localized anchors are the evidence's):

1. **Sequencing is already guaranteed — no work required.** ReactiveObject property access is lowered to `read(obj.key)` forms by a SEPARATE plugin (the @esportsplus/reactivity compiler — node_modules/@esportsplus/reactivity/build/compiler/object.js emits `read(this.#key)` forms). Both build entrypoints register the pipeline as `[reactivity, template]` — reactivity FIRST, template SECOND (src/compiler/plugins/vite.ts:28, src/compiler/plugins/tsc.ts:6) — so by the time this template-plugin pass runs, every ReactiveObject access is already the canonical `read(...)` form. This pass simply matches `read(...)`; it neither reorders plugins nor re-derives the lowering, and reactive-object selections are covered for free.

2. **Detection predicate** (new exported helper in src/compiler/ts-analyzer.ts, alongside analyze/fold): a `ts.BinaryExpression` whose `operatorToken` is `EqualsEqualsEqualsToken` (`===`) or `ExclamationEqualsEqualsToken` (`!==`); one operand is a `CallExpression` to `read` with exactly one argument (the signal access), the other operand is the key expression. The read call and the key may appear on either side.

3. **`read` identity resolution**: with a checker, the identifier must resolve to @esportsplus/reactivity's `read` via `imports.includes(checker, ident, '@esportsplus/reactivity', 'read')` — the same helper src/compiler/ts-parser.ts:32,55 uses to resolve `html`. Without a checker (the test harness builds sources via `ts.createSourceFile` with `checker: undefined` — tests/compiler/transform.ts:8-11), fall back to a plain name match on `read`.

4. **Safety guard — observer scope**: rewrite ONLY inside an Effect-typed binding arrow (the runtime observer). `analyze()` at src/compiler/ts-analyzer.ts:39 classifies ArrowFunction/FunctionExpression as `TYPES.Effect`; the compiler emits `setList(el, 'class', () => ...)` where that arrow IS the observer. Outside an observer, `signal.selector` degrades to `node.value === key` (harmless but pointless — node_modules/@esportsplus/reactivity/build/system.js:694), so a comparison NOT inside an Effect arrow is left untouched.

5. **Emit form**: `signal.selector(SIG, KEY)` for `===`; `!signal.selector(SIG, KEY)` for `!==`. `SIG` is the single argument of the `read(...)` call, `KEY` the opposite operand, both preserved verbatim. The template package does NOT re-export `signal` (src/index.ts exports attributes/event/hmr/utilities/html/render/slot/svg/types — no signal), so the emitted call references the named import directly.

6. **Import injection**: push an `ImportIntent { add: ['signal'], package: '@esportsplus/reactivity' }` (shape per node_modules/@esportsplus/typescript/build/compiler/types.d.ts:2-7) onto the transform result's `imports` (src/compiler/index.ts:79-83, which today pushes one namespace intent for the template package) ONLY when at least one rewrite actually fired; dedupe against an existing `signal` import already present in the source. No rewrite → no intent.

7. **Rewrite site**: `rewriteExpression` in src/compiler/codegen.ts:515 is the choke point — every binding expression's text flows through it (attribute bindings via generateAttributeBinding:78; reactive-call callbacks). It currently splices nested-template/reactive-call AST replacements (collectNestedReplacements:29), sorts replacements by descending start (codegen.ts:534), and prints via printer.printNode:525.

**Discretion point** (implementer decides): realize the selector rewrite as (i) another string-splice replacement in the same replacements array over the original expression text, or (ii) a pre-print AST match/transform. Criterion: it must compose with the existing nested-template/reactive-call splicing without corrupting offsets — a spliced selector replacement must never overlap or reorder against the descending-start sort's assumptions, and nested templates/reactive calls inside SIG or KEY must still be rewritten correctly.

**Edge cases the design pins**: (a) shadowed/local `read` not from the reactivity import → NOT rewritten (checker-gated; under the no-checker fallback the guard is name-match only, by design); (b) `read(x) === k` outside an Effect arrow → NOT rewritten; (c) ReactiveObject-lowered `read(obj.key) === k` → matches the same predicate (a free consequence of the pipeline order — reactivity lowers before this pass); (d) either-side operand order matches.

**Test plan sketch**: new tests/compiler/selector.ts mirrors the tests/compiler/transform.ts style — `createContext(source)` via `ts.createSourceFile`, `checker: undefined`, vitest. Cases: `===` rewrite in a class binding; `!==` negated emit; import-intent presence iff a rewrite fired; non-Effect position untouched; lowered-form match; shadowed-`read` guard exercised as a direct unit assertion on the predicate helper with a checker-backed program if the harness can supply one, otherwise on the helper's checker path in isolation (the transform-level harness is checker-less).

## Directives

1. src/compiler/ts-analyzer.ts — add the exported selection-comparison detection predicate helper (BinaryExpression `===`/`!==` with a single-argument `read(...)` call on either side; checker-backed `imports.includes` identity for `read` with plain name-match fallback when checker is undefined), alongside analyze/fold, leaving existing exports untouched.
2. src/compiler/codegen.ts — wire the selector rewrite into rewriteExpression using the predicate helper, gated to Effect-typed binding arrows, emitting `signal.selector(SIG, KEY)` / `!signal.selector(SIG, KEY)` composed with the existing nested-template/reactive-call replacement splicing without corrupting offsets, and surface a "rewrite fired" signal to the caller.
3. src/compiler/index.ts, tests/compiler/selector.ts — push the `{ add: ['signal'], package: '@esportsplus/reactivity' }` ImportIntent onto the transform result's imports only when a rewrite fired (deduped against an existing signal import), and author the focused transform test covering the acceptance cases.

## Acceptance

Scoped to this item's `tests` entries — never full-suite evidence:

- (a) tests/compiler/selector.ts: a class binding `() => read(sel) === row.id ? 'danger' : ''` compiles to output containing `signal.selector(sel, row.id)` and NOT `read(sel) === row.id`.
- (b) tests/compiler/selector.ts: `!==` emits `!signal.selector(...)`.
- (c) tests/compiler/selector.ts: the transform result's `imports` includes an intent adding `signal` from `@esportsplus/reactivity` when a rewrite fired, and does NOT include it when none fired.
- (d) shadowed/local `read` (not the reactivity import) is NOT rewritten — checker-gated; because the transform harness is checker-less (name-match fallback), this is asserted as a unit test on the predicate helper directly with a checker-backed context, or, if no checker can be supplied in-test, verified against the helper's checker branch in isolation.
- (e) tests/compiler/selector.ts: `read(x) === k` NOT inside an Effect arrow (bare non-binding position) is NOT rewritten.
- (f) tests/compiler/selector.ts: the `read(obj.key) === k` form (the canonical shape the reactivity plugin has already lowered ReactiveObject access into by the time this pass runs) matches the same predicate and is rewritten.
- (g) 0 regressions in tests/compiler/transform.ts, tests/compiler/codegen.ts, tests/compiler/integration.ts — run scoped.

## Reads

- src/compiler/ts-parser.ts — the `imports.includes(checker, ident, package, name)` identity-resolution pattern (used for `html` at :32,:55) to mirror for `read`
- tests/compiler/transform.ts — the createContext harness (`ts.createSourceFile`, `checker: undefined`) the new test mirrors; also a scoped regression suite
- tests/compiler/codegen.ts — scoped regression suite over the rewriteExpression hub edit
- tests/compiler/integration.ts — scoped end-to-end regression suite over the transform entry edit
- tests/compiler/ts-analyzer.ts — test-mirror sibling of the analyzer hub receiving the predicate helper
- tests/selector.ts — the landed runtime-primitive test: the behavior contract the rewrite targets
- bench/krausest/app.ts — the landed manual adoption showing the hand-written target shape the compiler must reproduce
- node_modules/@esportsplus/reactivity/build/system.d.ts — `signal.selector<T>(node: Signal<T>, key: T): boolean` signature (:21)
- node_modules/@esportsplus/reactivity/build/compiler/object.js — ReactiveObject lowering emitting the canonical `read(...)` forms (SELECTOR-AFTER-LOWERING requirement)
- node_modules/@esportsplus/typescript/build/compiler/types.d.ts — ImportIntent shape (:2-7)

## Notes

- Validation stays critic (frontmatter `validation` absent) deliberately: the shadowed-read guard and outside-observer scope carry judgment residue a machine check alone does not close. (Plugin sequencing is NOT a concern — the reactivity lowering runs before this pass by fixed pipeline order, so there is nothing for this item to guarantee there.) No `## Checks` block is authored: the repo's only admissible scoped-test form is the `agent:test` alias (not yet wired — it lands with the separate `agent-script-aliases` work the sibling `selector-helper.md` depends on), and referencing it here would dangle since that slug is in another spec dir. The `tests` frontmatter declares the coverage the engine runs.
- The template package's public surface must NOT grow a `signal` re-export — the emit references the injected named import from `@esportsplus/reactivity` directly.
- Rewriting outside an observer would be harmless at runtime (selector degrades to a plain compare) but is still forbidden: it churns output for zero benefit and widens the blast radius of the pass.
- Constraints binding the implementation: pnpm only; TypeScript strict under Node native strip mode — no new enum, `import type` for type-only imports, relative imports carry explicit `.ts` extensions, zero `any`; 4-space indent, LF; alphabetized members within groups; `let` for locals, `const` only for exports/immutable; internal fns use `function`, exported are `const` arrows, exports at bottom.
