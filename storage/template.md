# @esportsplus/template — upgrade and performance plan

Status: plan only, nothing implemented. Written 2026-11-03 against `@esportsplus/template@0.58.0`.

Scope: the compiler (`src/compiler/*`), the Vite/tsc plugin wrappers, HMR, and build/test tooling. The runtime (`slot/*`, `virtual/*`, `event/*`, `attributes.ts`) has its own benches (`bench/krausest`, `bench/virtual`, `bench/compiled`) and the deferred runtime items from the 0.58.0 plan are not repeated here. Items are `T-n`; cross-references are `TS-n` (typescript plan), `R-n` (reactivity plan), `V-n` (vite plan).

## 1. Where it stands (measured on `G:/ui/docs`, see typescript plan §1 for the full table)

- `@esportsplus/template/compiler/vite transform`: 20.3 s over 336 modules in a 40.8 s production build. 95% of that is waiting on tsgo; 12.7 s is `references.origins` (resolving every identifier of every file), 2.2 s is the staged second program that the reactivity → template ordering forces for 140 of the 186 template files, 2.9 s is `getTypeAtLocation` from codegen classification and reactivity's binding kinds.
- A nested worker bundle (`?worker&url` import in ui) re-transforms the shared part of the module graph: 9.4 s.
- `tsc -p tsconfig.build.json` (coordinated emit through a mirror directory, then `tsc-alias`): 4.0 s. `tsc --noEmit` on the dev config (src + test + bench, analyze on): 12.0 s with 67 analyze findings, almost all `Disposable` leaks in test fixtures.
- Dependencies: `@esportsplus/typescript` ^0.38.0, `@esportsplus/reactivity` ^0.40.0 (both current), `vitest` ^5.0.0 (5.1.0 available), `jsdom` ^30.0.1 (30.1.3), `@vitest/coverage-v8` ^5.0.0, `@types/node` ^26.4.1. 2 `~/` value imports in `src/`.
- `storage/plan.md` (the 0.58.0 runtime plan) was removed in `ff3404d chore: cleanup`; this file and its siblings replace it.

## 2. Changes

### T-1. Candidate-based site discovery (depends on TS-1)

Files: `src/compiler/ts-parser.ts` (`findTemplateArtifacts`, `exported`), `src/compiler/hmr.ts` (`plugin`).

`findTemplateArtifacts` already short-circuits files without an `import`/`require` and caches the `html` target declarations per program (`TARGETS`). With TS-1, `references.origins` only resolves identifiers rooted in the file's import bindings (any local name, so `import { html as h }` and a central `app.ts` re-export under another name both still resolve through the checker), their members, and in-file const aliases, so the per-file symbol request shrinks from "every identifier" to the import-rooted ones. No call-site change; the `sites`, `escapes` and `dependencies` logic is unchanged. Add `test/compiler` cases for `import { html as h }`, `app.h\`\`` through a namespace import of a central module that re-exports `html` renamed, and `export * from` two levels deep, so this package's own suite guards the rename path independently of typescript's.

The HMR plugin (`hmr.plugin`) calls `findTemplateArtifacts` first in the chain for every dev transform, so it benefits identically; keep it as the plan-only pass it is.

### T-2. Generate from composed text instead of a staged program (depends on TS-2, pairs with R-2)

Files: `src/compiler/codegen.ts`, `src/compiler/specialize.ts`, `src/compiler/removal.ts`, `src/compiler/index.ts`.

Today template runs *after* reactivity on a second, staged program whose source is reactivity's output, so `node.getText()` inside codegen already contains the lowered reactive reads. With TS-2 every plugin sees the original program and the coordinator composes nested replacements. Template's intents target original nodes, which is fine; what must change is every place codegen copies expression text into generated code:

- `codegen.ts`: `rewriteExpression`, `collectNestedReplacements` (`replaced(node, text)`), `generateNodeBinding`, attribute/event handler bodies, `text()` of static parts, hoisted constants (`hoisted` map keyed by code).
- `specialize.ts`: `constant()` folding reads `getText` of initializers; folded values are literals and never contain reactive reads, so this stays.
- `removal.ts` works on positions in the original source and is unaffected.

Rule: any expression that may contain a `reactive` binding read, a `reactive()` call or another plugin's replacement is emitted with `text(node)` (the coordinator helper); pure literals keep `getText`. The replacement ranges of nested `html\`\`` templates already nest (deepest first via `byDepthThenStart`), which is the ordering TS-2's composer needs.

Public output is unchanged: the composed text is byte-identical to what the staged pipeline produced, which is what the `test/compiler/*` snapshots assert. Add a test that runs reactivity + template through `coordinator.transform` on a fixture with reactive reads inside template expressions and nested templates, asserting the output equals the pre-TS-2 snapshot.

Gain: removes the 2.2 s staging cost and the duplicate `origins`/`getTypeAtLocation` pass on every file that uses both `reactive()` and `html\`\``, and one tsgo process per build.

### T-3. Fewer checker round-trips in codegen (depends on TS-3)

Files: `src/compiler/codegen.ts` (`classify`), `src/compiler/ts-analyzer.ts` (`analyze`, `isFunctionType`), `src/compiler/checker.ts`.

- Move `checker.ts` (`cached()` proxy) into `@esportsplus/typescript/compiler` (TS-3) and delete the local copy; `generateCode`, `hmr.analyze` and `ts-analyzer` receive the memoized checker from the context.
- `classify()`/`analyze()` ask `getTypeAtLocation` one expression at a time while walking a template. Collect the expressions of a template (they are already enumerated in `TemplateInfo.expressions`) and request their types in one batched call before generation; `isFunctionType`'s `getSignaturesOfType` per union member can be batched the same way (`getSignaturesOfType` has no array form; cache per `type.id` in the proxy).
- `isRenderableType` in `hmr.ts` calls `checker.resolveName('Node' | 'NodeList')` per export site; resolve once per program.

### T-4. Vite wrapper: nested builds and worker sub-bundles

File: `src/compiler/plugins/vite.ts`.

- The wrapper already uses a Rolldown-native `transform.filter`. After TS-7 the host plugin adds a build-mode result cache; the wrapper must key its `removals` warnings and HMR `state` per transform (it does) and must not reset `state.templates` on cache hits. Verify the 9.4 s worker sub-build becomes hash-only.
- `handleHotUpdate` full-reload throttle (`RELOAD_WINDOW`) and `state.templates` logic stay.
- `uncompiled: [UNCOMPILED]` stub detection stays.

### T-5. tsc path

Files: `tsconfig.build.json`, `tsconfig.json`, `src/compiler/plugins/tsc.ts`.

- The coordinated `tsc` build (reactivity plugin on template's own sources, then template's consumers run both) gains from TS-4 (single check, slimmer emit) and TS-5 (no `tsc-alias` spawn). Convert the 2 `~/` value imports first.
- `tsconfig.json` extends `tsconfig.package.dev.json`, so analyze runs over `test/**` with `warn` severity and reports 67 findings on every typecheck. Pick one: fix the fixture leaks (`using` in `test/virtual/slot.test.ts` and friends), or exclude `test/**`/`bench/**` from `tsc-guard` in the shared dev preset (TS-9). The first keeps the signal; the second halves the analyzed files.

### T-6. Test and bench tooling

- Dependency policy as in TS-11: every dependency to latest (`pnpm up --latest`), fix breaks, `link:` the local `@esportsplus/typescript` and `@esportsplus/reactivity` during the upgrade.
- `vitest` 5.1.0 (`--last-failed`/`--since-last-run` for `agent:test`; the 5.0 benchmark API rewrite already landed since `bench/*.bench.ts` use `bench.compare`), `@vitest/coverage-v8` 5.1.0, `jsdom` 30.1.3, `@types/node` 26.6.6.
- `environment: 'jsdom'` with `globals: true` boots jsdom per test file; routing uses `happy-dom`, which starts faster. Try `happy-dom` 21 on a branch; if `test/attributes.test.ts`, `test/event/*` and `test/virtual/*` pass unchanged, switch and align the two packages. Do not switch if any DOM-fidelity test regresses.
- `bench/compiler/transform.bench.ts` benchmarks `findTemplateArtifacts` + `generateCode` on a scratch program; add a variant that runs the full reactivity + template chain through `coordinator.transform` so T-1/T-2/T-3 are measured end to end, and record the before/after numbers in this file.
- Add `verify`, `packageManager`, `engines.node`, `lint: oxlint --type-aware` (TS-10, TS-11).
- `pnpm-workspace.yaml`: prune `minimumReleaseAgeExclude` to the `@esportsplus/*` wildcard plus the vitest entries still needed.
- `.gitignore` already ignores `.tmp/`; `storage/` is tracked and now holds these plans.

### T-7. SVG in templates (relates to V-2)

Nothing in the compiler changes for the external sprite. `html\`<svg><use href='${href}'/></svg>\`` works with both the dev form (`#id`) and the build form (`/assets/sprite.hash.svg#id`). Mention in the README's SVG section that icons needing document CSS inside the symbol should be authored as inline `html\`<svg>…\`` templates rather than sprite imports.

## 3. Public API changes

None. `html`, `component`, `render`, `./env`, `./hmr`, `./compiler`, `./compiler/tsc`, `./compiler/vite` and the compiled output are unchanged. The plugin wrapper's options (`{ root }`) are unchanged.

## 4. Order of work

1. T-6 bumps and the 2 relative-import conversions.
2. T-1 as soon as `@esportsplus/typescript` ships TS-1; re-profile ui docs.
3. T-3 with TS-3.
4. T-2 with TS-2 and R-2 — one coordinated release of typescript, reactivity, template; the new end-to-end coordinator test is the gate.
5. T-4 falls out of TS-7; T-5 with TS-4/TS-5; T-7 with V-2.

## 5. Implementation notes (2026-11-03, branch `upgrade/stack-2026-11`)

Built against the local `@esportsplus/typescript` and `@esportsplus/reactivity` (`link:`), both on `upgrade/stack-2026-11`.

- **T-1**: no call-site change; `test/compiler/discovery.test.ts` adds `import { html as h }`, `app.h` through a namespace import of a central module re-exporting `html` renamed, and `export *` two levels deep, each compiled and rendered with and without `reactive()` in the module.
- **T-2**: codegen still runs in `transform` (ids and template factories keep their source order) but copied source is a token resolved with `text(node)` when the coordinator generates. A rewrite nested in copied source (nested template, slot call, selector) is its own intent emitting a marker, so it composes under another plugin's replacement. Hoisted handlers that copy source are `prepend` function entries, evaluated by the coordinator with `text()` after composing. Gate `test/compiler/chain.test.ts` (hmr + reactivity + template through the Vite wrapper over the 30 corpus modules and 3 fixtures), captured on typescript 0.38.0 / reactivity 0.40.0: byte-identical except 4 lines, all intentional reactivity fixes: `chain-writes` 3 hoisted handlers (`write(step, …)read(step)` garbage → a read inside the write) and `chain-members` `read(list[count])` → `list[read(count)]`.
- **T-3**: local `checker.ts` deleted for `checker.cached`; one `getTypeAtLocation(nodes[])` per file before generation: type round-trips over the corpus 132 → 94. `getSignaturesOfType` reaches tsgo 5 times over the corpus, so no local `type.id` cache. HMR resolves `Node`/`NodeList` once per program.
- **T-4**: the wrapper calls `transform.handler`; removals are located by their source offset (the occurrence search is gone). A nested build is answered from the host cache without re-reporting removals; HMR state is dev-only, where nothing is cached.
- **T-5**: 2 `~/` imports made relative. `tsc --noEmit` still reports 67 tsc-guard findings (left as is).
- **T-6**: all deps latest (vitest 5.1.0, coverage 5.1.0, jsdom 30.1.3, @types/node 26.6.6, oxlint 1.90.0, oxlint-tsgolint 7.0.2005). happy-dom 21.0.4 (branch `experiment/happy-dom`): 5 of 1689 tests fail (IDL `checked` reset, listeners after a throwing handler ×2, the 200k-group ArraySlot build times out) and the run is ~3× slower, so jsdom stays. `bench/slot/bulk.bench.ts` ran out of heap before this work too (dev slot tracking + a loop that never yields); samples now release their slot and rows.
- **Bench** `bench/compiler/chain.bench.ts` (reactivity + template via `coordinator.transform`, 30 modules, fresh program per pass), mean per pass: before 191–209 ms (median ≈197), after 137–160 ms (median ≈146), ≈26% faster; after the prepend-entry and case-insensitive-lint follow-up 135–142 ms over 3 runs. `findTemplateArtifacts + generateCode (with checker)`, 100 components: ≈37 ms → ≈25 ms.
- **T-7**: README SVG section notes the sprite `<use>` forms and when an icon must be an inline `html` template.

## 6. Diff-based class/style writes (2026-11-03, branch `perf/diff-writes`)

`src/attributes.ts` no longer serialises a whole class or style list on each change, so a class or declaration written from outside the template (`classList.add`, `style.setProperty('--morph-x', …)` in ui's `card.ts`, third-party code) survives every store write. Public API (`setClass`, `setList`, `setProperty`, `setProperties`, `setStyle`) and compiled output are unchanged; `test/compiler` snapshots untouched.

- **Classes**: a refcount per token (`Map<token, writers>`). The static list (compiled `parts[0]`, static parts, the attribute at first contact for `setList`-created state) holds its tokens for good; a part adds 1 per token it returns. A token entering (0 → 1) is added, leaving (1 → 0) removed. Several changes in one run are one write: `classList.add(...)`, `classList.remove(...)`, or for a mixed change the attribute's tokens (foreign ones included) less the removed plus the added, written once (never `classList`, which jsdom keeps in sync on every later write once created).
- **Styles**: per property a stack of declarations, the static one at the bottom and parts above it, the last part to write on top (last-writer-wins). A retraction uncovers the declaration beneath (or removes the property when none is left); a retraction under the top writes nothing. Applied with `style.setProperty(name, value, priority)` / `style.removeProperty(name)`; `!important` (any spacing/case) becomes the priority.
- **Tokens that are not `name: value`**: they arise only from strings (`collect`), and today's `cssText` path let the CSS parser drop them; they are still accepted and ignored. The one case today's join really relied on, a `;` inside `url(data:…;base64,…)` or a quoted string, is handled by splitting style strings on `;` outside parentheses and quotes, so every surviving token is a declaration and there is **no `cssText` exception**.
- **First write**: the compiler strips a bound list's static tokens from the clone (`parser.ts`), so a compiled element reaches `setClass`/`setStyle` without the attribute. An element without the attribute provably holds nothing foreign, so it gets the whole list in one `className`/`cssText` assignment (spy-tested). An element that already holds its list gets only the missing tokens, never a re-serialisation. A one-class toggle is written whole when the attribute is empty or holds only the class leaving (the krausest select path).
- Removed: the sole-owner `setProperty` fast path, `join`, `rewrite`, `sole`, the seed's trailing-`;` trim.

Bench, 3 runs each, same machine (other agents' node processes idle in the background). Before = main @ 622945b, after = `perf/diff-writes`. ms, min of the 3 runs' minimums / median of the 3 runs' medians. jsdom: `pnpm bench:krausest`. Browser: `bench/krausest/run-browser.mjs` on system Chrome 156 (the cached Playwright Chromium 153 hangs under `--dump-dom`: its sandbox cannot access the executable). The browser clamps `performance.now()` to 0.1 ms.

| krausest | jsdom before | jsdom after | browser before | browser after |
|---|---|---|---|---|
| create 1,000 rows | 36.63 / 42.25 | 37.16 / 42.48 | 30.40 / 33.40 | 31.60 / 32.70 |
| replace all 1,000 rows | 39.78 / 44.84 | 40.84 / 44.09 | 33.60 / 35.50 | 32.50 / 35.40 |
| partial update every 10th row | 0.058 / 0.068 | 0.055 / 0.070 | 4.30 / 5.60 | 4.70 / 5.90 |
| select row | 0.0037 / 0.0040 | 0.0041 / 0.0050 | 0.00 / 0.00 | 0.00 / 0.00 |
| swap rows | 0.08 / 0.12 | 0.08 / 0.10 | 1.40 / 1.90 | 1.50 / 2.00 |
| remove one row | 0.02 / 0.02 | 0.02 / 0.02 | 1.20 / 1.90 | 1.30 / 1.70 |
| create 10,000 rows | 403.49 / 431.41 | 410.08 / 426.32 | 439.00 / 462.80 | 429.90 / 453.40 |
| append 1,000 rows to 10,000 | 36.29 / 39.49 | 35.74 / 38.74 | 56.00 / 59.30 | 54.90 / 58.40 |
| clear 10,000 rows | 47.23 / 52.16 | 46.76 / 49.81 | 27.40 / 29.70 | 27.00 / 29.20 |
| clear 1,000 rows | 2.77 / 4.42 | 2.73 / 3.87 | 2.00 / 2.60 | 1.90 / 2.40 |

Noise (half the spread of the 3 medians): ±0.2–5% on the create/replace/append/clear-10k rows, ±8–25% on the sub-ms rows. Every row is within noise except jsdom select row (+25%, about +0.9 µs). Traced with a 20k-select loop: first +60%, from `update()` touching `element.classList` (jsdom then re-parses a DOMTokenList on every later class write) and from `classList` add/remove being 2× a `className` set in jsdom. Fixed by keeping `classList` out of the whole-write paths and writing a provably foreign-free toggle whole. The remainder is the refcount bookkeeping plus one `getAttribute` per toggle, the price of foreign safety. In Chrome the same loop measures 1.05 → 1.19 µs per select (+0.13 µs, layout included).

Micro-bench `bench/attributes/diff.bench.ts` (jsdom, ops/s, 3 runs; one of 5 parts changes per iteration). Before, the store's first write wiped the 20 foreign declarations, so its "20 foreign" case is really 0 foreign:

| case | before | after |
|---|---|---|
| store style, no foreign | 372k–377k | 403k–416k |
| store style, 20 foreign | 371k–378k (foreign wiped) | 277k–284k (foreign kept) |
| raw `cssText` rewrite incl. 20 foreign (what a correct full rewrite costs) | 43k–45k | 43k–45k |
| raw `setProperty`, 20 foreign | 399k–400k | 393k–403k |
| store class, one class swapped | 914k–949k | 557k–567k |

The class swap pays for reading the attribute (foreign tokens) instead of blind-writing the joined list. Attribute cases of `pnpm bench:run` (`bench/attributes/apply.bench.ts`, `runtime.bench.ts` class/style) do not reach the list store and stay within run-to-run noise (data-id drain 1,924–2,050 → 1,997–2,126 ops/s; expando drain 567–586 → 571–609).

Addendum (`b099fdd`): a single class leaving while a single class enters now goes through `classList.replace`, keeping the class's position; if foreign code already removed the old class the new one is added. Every other mixed change still reads the attribute once and writes once. The six tests that asserted class strings now assert class sets. jsdom micro-bench for that path: 512k–519k ops/s against 563k–566k for the string rebuild (jsdom slows every class write once `classList` has been touched); in Chrome `replace` measured 0.37 µs against 0.55 µs per swap. Krausest select row and partial update unchanged within noise.
