# @esportsplus/reactivity — upgrade and performance plan

Status: plan only, nothing implemented. Written 2026-11-03 against `@esportsplus/reactivity@0.40.0`.

The runtime (`src/system.ts`, `src/reactive/*`) was not profiled in this pass; its benches (`bench/*.bench.ts`) are the gate for runtime changes and nothing below touches runtime semantics. This plan is about the compiler (`src/compiler/*`) and the package's build/test tooling. Items are `R-n`; cross-references are `TS-n` (typescript plan) and `T-n` (template plan).

## 1. Where it stands

- The compiler plugin resolves *every* identifier in *every* file against the program (`bindings.create` → `references.origins`) before deciding whether the file uses `reactive` at all. It has no `patterns` and no cheap text pre-check, so a file that imports nothing still pays a full symbol resolution round-trip. In the ui docs build this call pattern (shared with template) was 12.7 s of a 20 s transform cost (see typescript plan, section 1).
- When reactivity edits a file that template also compiles (140 of 186 template files in ui), the coordinator stages a second program for template; reactivity's output is what template type-checks against. That staging exists because of reactivity's rewrites, and TS-2 removes it.
- `bindings.ts` keeps its own per-program caches (`arrays`, `assignments`, `kinds`) and calls the raw checker; template memoizes its checker and reactivity does not, so overlapping queries (`getTypeAtLocation` of the same expressions) go to tsgo twice.
- Tooling: `vite` ^8.2.2 (dev), `vitest` ^5.0.0, `@esportsplus/typescript` ^0.38.0, `@types/node` ^26.4.1; `tsconfig.json` extends `tsconfig.package.json` (not the `.dev` variant, so tests and benches are not type-checked by `tsc --noEmit`; `agent:test` runs `tsc --noEmit && vitest run`). 7 `~/` value imports in `src/`.

## 2. Changes

### R-1. Skip files that cannot reach `reactive` before resolving anything

File: `src/compiler/index.ts`, `src/compiler/bindings.ts` (`create`).

Adopt the import-rooted resolution from TS-1: `references.origins` keeps only identifiers that are import bindings of the file (under any local name, so `import { reactive as x }` is covered), members reached through them (`app.x`, `const { x } = app`), and in-file const aliases or assigned variables derived from them (`const count = reactive(0)`, `let x; x = reactive(...)`). Resolution of the kept identifiers is still the checker's, so renamed re-exports through a central `app.ts`, `export *`, default exports and library barrels keep working; the filter never looks at names. Add the same `REGEX_IMPORT` guard template uses (`/\bimport\b|\brequire\s*\(/`): a file with no import cannot hold a binding from this package. Reactive *arrays* found by type (`bindings.arrays`, brand `once` on `ReactiveArray`) are discovered from the nodes the primitives/array passes hand in, which stay unchanged.

`bindings.kind()` depends on reads of a `let` that is assigned `reactive(...)` later being in `origins`; TS-1 rule (3) keeps them. Pin that with a test here as well as in typescript (`let x; x = reactive(0); x` in one file, and the same binding exported and read from another file).

No public API change; the `dependencies` list the plugin returns (declaration + `through` files) is computed the same way from the identifiers that are resolved.

### R-2. Compose with template on one program

Files: `src/compiler/{index,array,object,primitives}.ts`.

With TS-2 the coordinator composes nested replacements from all plugins against the original AST. Reactivity's intents already target original nodes and generate text from `node.getText(sourceFile)` of *argument* expressions (`reactive(...)` lowering in `index.ts`, element writes in `array.ts`, member rewrites in `primitives.ts`). Where a generated snippet copies a sub-expression that another plugin could have replaced (a `reactive()` argument containing `html\`\``), switch that copy to the `text(node)` helper the coordinator passes. Audit list: `index.ts` (`call.arguments.map(a => a.getText(...))`), `object.ts` (property initializers), `array.ts` (callback bodies), `primitives.ts` (compound assignment right-hand sides).

Depends on TS-2 landing in `@esportsplus/typescript`; release reactivity in the same window as template `T-2`.

### R-3. Use the shared memoized checker and batch classification queries

File: `src/compiler/bindings.ts`.

Once TS-3 hands every plugin a memoizing checker, delete the `kinds`/`arrays` memo maps that duplicate it (keep `assignments`, which is an AST index, not a checker memo). `classify()` calls `getTypeAtLocation` per `reactive()` call; collect the calls in `index.ts` first and classify them with one `getTypeAtLocation(nodes[])` request, as `arrays()` already does.

### R-4. Vite plugin export: native filter

File: `src/compiler/plugins/vite.ts`.

The standalone `@esportsplus/reactivity/compiler/vite` plugin inherits whatever `plugin.vite` returns. After TS-7 that includes a Rolldown-native `transform.filter` and a build-mode result cache, so nothing changes here beyond the dependency bump. If TS-7 is delayed, wrap the hook with the same filter object template's wrapper uses (`REGEX_SCRIPT` include, `node_modules`/virtual exclude).

### R-5. Build and test tooling

- `tsconfig.json`: extend `tsconfig.package.dev.json` so `tsc --noEmit` covers `test/**` and `bench/**` like the other packages, and add `tsconfig.build.json` extending `tsconfig.package.json` for `build` (routing and template already use this split). Decide whether `tsc-guard` findings in tests should be reported (see TS-9).
- Convert the 7 `~/` value imports in `src/` to relative imports before TS-5 removes `tsc-alias`.
- Dependency policy as in TS-11: every dependency to latest (`pnpm up --latest`), fix breaks, `link:` the local `@esportsplus/typescript` during the upgrade.
- Bumps: `vite` 8.3.5, `vitest` 5.1.0 (`--last-failed` for `agent:test`), `@types/node` 26.6.6, `@esportsplus/typescript` to the release that carries TS-1/TS-3; later TS-2 and TS-6 (no code change for 7.1, the `ts` re-export absorbs the path rename).
- Add `verify` (`build && typecheck && lint && test`), `packageManager` (exact pnpm) and `engines.node` for the shared publish workflow; add `oxlint --type-aware` per TS-10.
- `pnpm-workspace.yaml`: prune the per-version `minimumReleaseAgeExclude` lists to the `@esportsplus/*` wildcard.

### R-6. Runtime: measure, do not change (this pass)

`src/system.ts` (1292 lines) and `src/reactive/array.ts` were not profiled. Before any runtime change, record `pnpm bench` (`cellx`, `kairo`, `molbench`, `system`, `ownership`, `dynamic`) under Node 26.8.1 as the baseline in this file, and add a compiled-output bench (reactivity transform applied to a fixture, then run) so compiler changes R-1..R-3 are proven output-identical by the existing `test/compiler/*` snapshots and runtime-neutral by the bench.

## 3. Public API changes

None. Exports (`.`, `./compiler`, `./compiler/tsc`, `./compiler/vite`), the `reactive()`/`effect()`/`root()`/`read()` runtime surface and the compiled output format are unchanged. The only observable difference is build time.

## 4. Order of work

1. R-5 (tooling, relative imports) — mechanical, any time.
2. R-1 + R-3 after `@esportsplus/typescript` ships TS-1/TS-3; verify with `test/compiler` and the ui docs profile.
3. R-2 with TS-2 and template `T-2` (coordinated release).
4. R-4 falls out of TS-7.

## 5. Implementation notes (2026-11-03, branch `upgrade/stack-2026-11`, 17 commits, not pushed)

Implemented: R-1, R-2, R-3 (partially: `kinds`/`arrays` caches kept, measured as not duplicating the shared memo at the time; re-evaluate now that `checker.cached` memoizes type-keyed queries), R-4 (via link), R-5, R-6 (bench added). Gate: build, typecheck, lint, 502 tests, benches. `@esportsplus/typescript` moved to `dependencies` (the compiler exports import it at runtime; this was already wrong in 0.40.0).

Two bugs in 0.40.0 surfaced and fixed by the `text()` migration: a signal read nested inside another rewrite produced invalid code (`write(x, y)read(y)`), and `list[count]` compiled to `read(list[count])` instead of `list[read(count)]`. Compiled output of all other fixtures is byte-identical (snapshot test captured before the migration).

Bench: modules without `reactive` 12.9–13.9k → 21.5–23.1k ops/s (import guard); whole-app transform unchanged (1.19–1.30k → 1.19–1.41k). Runtime source unchanged apart from lint suppressions; runtime bench deltas are toolchain noise.

Public API: unchanged.

## 6. Implementation notes (round 2, 2026-11-03, branch `perf/compiler-and-runtime`, 8 commits, not pushed)

Gate: `pnpm run verify` (build, typecheck with 30 analyze findings as before, lint, 502 tests) and `pnpm bench`, both against published `@esportsplus/typescript` 0.40.0 (the work was measured through `link:../typescript`; 0.40.0's `checker.cached` has identical CACHED/TYPED sets). Round-trips counted by patching the tsgo sync `Client.prototype.apiRequest`/`apiRequestBinary` (every IPC request, not only checker methods). Bench figures are ops/s, min–max of 3 runs.

**Compiler caches vs the shared memo.** Round-trips are identical with or without either map: `test/compiler` suite 1,928 requests in all four combinations; bench app with one checker per program (what `tsc` and `vite` hand in: `entry.project.checker` is stable per snapshot, and program and checker are replaced together) 46 in all four. Only `bench/compiler.bench.ts`, which wraps the checker in a fresh `Proxy` per transform and so resets the memo but not the program-keyed maps, sees savings (first pass 50 vs 48 from `arrays`, ~5 per later pass from `arrays`, ~1 from `kinds`). Time with one checker per program: main 6,160–6,232, neither 4,749–4,855, kinds only 6,056–6,258, arrays only 4,717–4,767. Result: `arrays` deleted (saves neither round-trips nor time in real hosts); `kinds` kept with a WHY (no round-trips, but `kind()` runs per read of a binding and re-deriving it dominates a warm transform). The literal rule "keep only if it saves round-trips" would have cost 22% of warm transform time, so the rule was applied to time as well. `bench/compiler.bench.ts` "every module of the app" reads 1,839–2,258 → 1,550–1,684 because of the Proxy artifact above; worth making that bench hand in one checker per program (or report both modes).

**Batched object property types.** Syntax decides every property but a non-literal value; those are now collected per file and typed with one `getTypeAtLocation(nodes[])`. Module with 4 objects × 5 non-literal values: 40 → 21 requests (20 single → 1 batch). `test/compiler`: 1,928 either way (at most one such value per fixture file). Compiled-output snapshots unchanged.

**Runtime profiling.** Two measurement traps: (1) vitest's bench `GetterTracker` routes every imported-binding read through a Map-counting getter — 36% of all samples; (2) even without it, vite SSR namespace getters (`__vite_ssr_import_0__.STATE_*`) dominate the hottest lines of `recompute`. Hotspots were therefore taken from a profile of the same benches against compiled `build/` loaded natively (`server.deps.external`), with the V8 profiler driven from a setup file (vitest forks exit before `--cpu-prof` flushes). Native self time: `recompute` 7.4%, `read` 2.4%, `link` 2.3%, `stabilize` 1.5%, `makeComputed` 1.3%, `root` 1.0%, `dispose` 0.9%, `insertIntoHeap` 0.9%, `makeNode` 0.9%, `deleteFromHeap` 0.7%; array `sort` 1.7%, `splice` 1.6%, `push` 1.5%, `dispose` 0.9%, constructor 0.7%, `concat`/`unshift`/`shift`/`reverse` ~0.55% each. In `system.ts` the time sits on first-touch field loads (`computed.state`, `dep.rv`, `observer`) of an already pooled, single-hidden-class structure; in `array.ts` 90–100% of each mutator was inside `super.<builtin>()`: V8 runs Array.prototype mutators on the generic path for an instance whose prototype is not `Array.prototype` (isolated: push 9×, splice 10×, reverse 11×, unshift 16×, shift 86× a plain array).

Accepted (each differentially fuzzed against the native method on sparse arrays with negative, fractional, NaN and infinite arguments; a mutation of the hole handling is caught):

| change | bench before → after |
|---|---|
| push/concat via indexed stores | push 1: 6.45–6.63M → 8.14–8.31M; push 10 (one call) 4.70–4.75M → 6.95–7.21M; push 10 (10 calls) 1.59–1.70M → 2.75–2.83M; dispatch to 1 listener 5.02–5.39M → 7.18–7.40M; concat 100: 353–366k → 1.15–1.22M |
| splice/shift/unshift via `place()` (spec element steps, holes as holes, packed stays packed) | splice replace 1.79–1.84M → 4.60–4.75M; insert 1.72–1.78M → 5.28–5.77M; remove 1.18–1.20M → 4.44–4.47M; shift 1.46–1.55M → 4.73–5.10M; unshift 10: 1.31–1.34M → 6.31–6.69M |
| reverse via the spec swap loop | reverse 100: 292–296k → 1.47–1.52M |
| sort a plain copy, write back, holes at the end | sort 10: 1.61–1.65M → 2.61–2.93M; 100: 231–236k → 528–534k; 1000: 23.7–24.1k → 53.0–54.0k |

Rejected: packed `heap` array in `system.ts` (computed/propagation rows +2–4% but every range overlaps the baseline, ownership rows noisy/lower — not consistent); `isPromise` (0.02% of samples, creation only); `pop`/`dispose` via the length setter (slower than generic `super.pop` in isolation); `fn.length` in `root()` (65% of its self time, but it is the dispose-parameter detection, i.e. semantics). Not applicable: dependency-list allocation per read (links are pooled, `read` allocates nothing), Set/Map churn in tracking (none; only `signal.selector` keys and the async-factory WeakMap), hidden classes (nodes, signals, selector entries and links each share one literal shape). Proposal without a bench: `effect(fn, apply)` allocates `() => apply(v, prev)` per run for `untrack`; inlining the observer/scope swap removes it, but no bench exercises `apply`. Suggestion: set `benchmark.suppressExportGetterWarnings: true` in `vitest.config.ts` so `pnpm bench` stops charging imported-binding reads to the code under test (changes absolute numbers, so not done here). Next runtime target: `ReactiveObject` constructor (2.8% native, `src/reactive/object.ts`).

Final `pnpm bench` vs round-1 baseline: 23 rows above the baseline range (all array mutators and events, `$set` no-op +4%, ReactiveObject write +13%, reschedule path +9%); `system.ts` is unchanged and its rows are within run-to-run noise (molbench 18.86–19.05k → 18.66–18.82k on recheck).

Public API: unchanged. Commits: `583440c` perf(compiler): drop kinds and arrays memo maps; `443163c` perf(compiler): type object property values in one request; `721a652` perf(array): push and concat with indexed stores; `9bf4989` perf(array): splice, shift and unshift without the builtins; `dd614bb` perf(array): reverse without the builtin; `6e48147` perf(array): sort a plain copy and write it back; `6132cc5` perf(compiler): keep the kinds memo for repeated reads; `0e7f066` chore(deps): use published @esportsplus/typescript 0.40.0.
