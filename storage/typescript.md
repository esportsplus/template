# @esportsplus/typescript — upgrade and performance plan

Status: plan only, nothing implemented. Written 2026-11-03 against `@esportsplus/typescript@0.38.0`.

This package is the root of the stack: `reactivity`, `template`, `routing`, `vite` and every app build run through its `tsc` wrapper, its `coordinator`, its `language-service` (tsgo API process) and its `plugin.vite` host. Every millisecond saved here is saved in every build. The plans for the other four packages reference the items below by number (`TS-n`).

## 1. Measurements that drive this plan

Taken on this machine (Windows 11, Node 26.8.1, TypeScript 7.0.2) on `G:/ui/docs`, a real app build that runs the reactivity + template compiler chain through `plugin.vite`:

| Measurement | Value |
|---|---|
| `vite build` wall clock | 40.8 s |
| Rolldown `PLUGIN_TIMINGS`: JS plugin callbacks | 28.3 s of 28.8 s bundle time |
| `@esportsplus/template/compiler/vite transform` | 20.3 s, 336 calls (~60 ms per file) |
| `vite:worker load` (nested worker bundle re-running the same transforms) | 9.4 s, 1 call |
| CPU profile: inclusive time in `coordinator.transform` | 20.7 s |
| CPU profile: blocked in synchronous tsgo pipe reads (`syncChannel.readByte` / native `read`) | 19.6 s |
| CPU profile: `references.origins` → batched `checker.getSymbolAtLocation(identifiers[])` | 12.7 s |
| CPU profile: `language-service.stage` → `advance` → `updateSnapshot` (second program per file) | 2.2 s |
| CPU profile: `checker.getTypeAtLocation` (codegen + bindings classification) | 2.9 s |
| CPU profile: `language-service.updateMany` → `updateSnapshot` | 0.95 s |
| CPU profile: `checker.getImmediateAliasedSymbol` (`references.follow`) | 0.67 s |
| `template`: `tsc -p tsconfig.build.json` (coordinated build, reactivity plugin) | 4.0 s |
| `template`: `tsc --noEmit` on `tsconfig.json` (dev config: src + test + bench, analyze on) | 12.0 s, 67 analyze findings |

Conclusions:

- The compiler chain is not CPU bound in JS. 95% of its time is waiting on tsgo answering checker queries. The number and shape of queries is the problem, not the JS around them.
- One pattern, `references.origins`, is 61% of the whole transform cost. It asks tsgo for the symbol of every identifier that is an import/variable name *or any property-access name* in every file, which forces tsgo to type-check essentially the entire file.
- In the ui app, 140 of the 186 files that use `html\`\`` also call `reactive()`. For each of those the coordinator stages a second program after the reactivity plugin edits the file, and the template plugin then recomputes `origins` on that new program. Those files pay the 61% twice.
- The `tsc` wrapper type-checks projects twice (once through the API, once through a spawned `tsc.js`), copies the whole source tree into a mirror directory for emit, then spawns `tsc-alias` as a third process.

## 2. Changes, ordered by impact

### TS-1. Resolve only candidate identifiers in `references.origins` (largest win, no public API change)

File: `src/compiler/references.ts` (`bound`, `values`, `origins`).

Today `values()` collects every identifier whose name is bound by an import or variable in the file *plus every property-access name* (`parent.name === node`) and sends them in one `getSymbolAtLocation(nodes[])` request. The comment justifies property names with "`f().name` can reach an export whatever `f` is", but `holds()` only ever returns true for declarations of kind `VariableDeclaration` or `BindingElement`, so a member reached through a call result or an object literal can never be a hit. The only property accesses that can hit are `ns.x` / `ns['x']` where `ns` ultimately resolves to a namespace import.

**Non-negotiable constraint.** Renamed imports (`import { reactive as x }`), renamed re-exports through a central `app.ts` (`export { reactive as x } from '@esportsplus/reactivity'`, `export * from`, `export default reactive`, `export const x = reactive`) and library-internal barrels have all broken the compilers before. The fix must therefore never filter by *name*. It filters by *where a value can come from*: TypeScript's alias machinery (`getSymbolAtLocation` + `follow()`) still decides what every kept identifier resolves to, and the pruning only removes identifiers that `holds()`/`kind()` already reject by declaration kind.

Prune `values()` to identifiers rooted in the file's import bindings, computed syntactically per file (no checker, no program-wide scan):

1. **Import bindings, whatever they are called.** Every local name introduced by an import declaration: named specifiers (`x` in `{ reactive as x }`), default imports, namespace imports, `import x = require()`. All of them, unconditionally; a file has tens of these, not thousands of identifiers.
2. **Members whose receiver chain roots in (1) or (3).** `app.x`, `app['x']`, `ns.state.count` are kept (property name identifier / element-access string pushed as today). `this.x`, `v.list`, `document.body`, `f().x` are dropped: today they are resolved and then rejected by `holds()` because a property declaration is never a `VariableDeclaration`/`BindingElement`.
3. **In-file aliases, to a fixpoint.** Const declarations and binding elements whose initializer references a kept identifier (`const h = html`, `const { reactive: r } = ns`, `const count = reactive(0)`), and any variable name that is *assigned* from such an expression anywhere in the file (`let x; x = reactive(...)`, which `bindings.assignments` in reactivity relies on). Shorthand properties of kept names are kept.
4. `isDeclarationName`, the `LINKS` exclusion and type-position skipping stay exactly as they are.
5. `dependencies` tracking is unchanged: `follow()` still records `through` for every resolved identifier, so a change to `app.ts` still invalidates every file compiled through it.

Why renames and re-exports are safe under this rule: the identifier `x` from `import { reactive as x }` is kept by (1) and resolved by the checker to the alias, which `follow()` walks to reactivity's declaration. A consumer of `app.ts` imports *some* name from `./app`; that name is kept by (1) regardless of what it is, and the checker follows `app.ts`'s re-export (renamed, starred or default) to the declaration. A library's own barrel rename (`export { reactive as signal }` inside `node_modules`) is reached the same way. Shadowing (`(reactive) => reactive(1)`) is still rejected because the checker resolves the identifier to the parameter.

What is dropped and why it is equivalent: parameters, function/class names, `let`/`var` locals never initialized or assigned from an import-rooted expression, and member access on non-import receivers. For each of these, today's `holds()`/`kind()` return false after a round-trip; after the change they return false without one.

Expected effect: `getSymbolAtLocation` goes from "every identifier in the file" to "import-rooted identifiers only". On the ui docs build this is the 12.7 s line; the target is under 1 s. `reactivity` (`bindings.create`) and `template` (`findTemplateArtifacts`, `hmr.plugin`) call `origins` and need no code change.

Verification is the gate for this item. `test/compiler/references.test.ts` must pin, as separate cases that fail if any of (1)–(3) is implemented too narrowly: `import { reactive as x }`; `import { html as h }` used as `h\`\``; `export { reactive as x } from` in a central module consumed under `x`; `export * from` chains two deep; `export default reactive` imported as `r`; `export const x = reactive` consumed from another file; `import * as app` with `app.x`, `app['x']` and `const { x: y } = app`; a library-internal barrel rename under `test/fixtures/node_modules`; `let x; x = reactive(0)` read before and after the assignment; a parameter named `reactive` shadowing the import (must not be a site); and `obj.html` where `obj` is a parameter (must not be resolved). Add a bench in `bench/compiler` that reports identifiers sent per file so the pruning is visible, and run `reactivity`'s and `template`'s `test/compiler` suites against the new release before publishing.

### TS-2. Compose plugin replacements on one program instead of staging a second one

Files: `src/compiler/coordinator.ts` (`transform`, `staged`, `languageService.stage`), `src/compiler/language-service.ts` (`stage`, `Staging`), `src/compiler/types.ts`.

Today when plugin *i* changes the file and a plugin *i+1* follows, the coordinator uploads the original text to the entry program, creates a *second* tsgo API process ("staging") holding the intermediate text, and hands plugin *i+1* that staged program. Every later file re-advances the staging snapshot. Measured: 2.2 s in `stage`, plus the duplicated `origins` pass on the staged program for every file both reactivity and template touch (most of them in a real app).

Proposal: let every plugin analyse the *same* original program and return intents against the original AST, and have the coordinator compose nested replacements:

- `ReplacementIntent.generate(sourceFile, text)` receives a second argument `text(node)` that returns the node's current text with any replacements from earlier plugins (or earlier intents) already applied inside that range. Plugins that call `node.getText()` keep working for nodes that contain no inner replacements; only the template codegen has to switch to `text()` for expression bodies it copies into generated code (see template plan `T-2`).
- The coordinator sorts all replacements by range, nests contained ranges, and applies them in one generation. Overlapping-but-not-nested ranges are a hard error naming both plugins.
- `prepend` and `imports` already compose without re-parsing (`layout()`/`shift()` from 0.37.1), so nothing changes there.
- `languageService.stage`, the `Staging` type and the "staged peer" process are deleted. One tsgo process per project remains (plus the scratch parser).

Expected effect on the ui docs build: removes the 2.2 s staging cost and the second `origins`/`getTypeAtLocation` pass on 140 files. Together with TS-1 this should bring the 20 s transform cost to a few seconds.

Public API impact: additive (`generate` gets an optional second argument). Document it in the README `Types` section. Order dependency: template `T-2` must land in the same release window because template's codegen relies on the staged program's lowered text today.

### TS-3. Hand plugins a memoized checker

File: `src/compiler/coordinator.ts`; move `template/src/compiler/checker.ts` (the `cached()` proxy) into `src/compiler/checker.ts` and export it from `compiler/index.ts`.

Every checker query is a synchronous IPC round-trip. Template wraps the checker in a per-program memoizing proxy; reactivity does not, and the two compilers ask overlapping questions (`getTypeAtLocation` of the same expressions, `getSymbolAtLocation` of the same identifiers). Build the proxy once per program in the coordinator and pass it in `TransformContext.checker`, so every plugin and the `references` module share one cache. Add the batch forms (`getSymbolAtLocation(nodes[])`, `getTypeAtLocation(nodes[])`) to the proxy so cached entries are skipped and only misses go to tsgo.

Measured upper bound: 2.9 s `getTypeAtLocation` + 0.67 s `getImmediateAliasedSymbol`. No public API change.

### TS-4. `tsc` wrapper: check once, emit once, no mirror directory, no process chain

File: `src/cli/tsc.ts` (`build`, `emit`, `passthrough`, `runAnalyze`, `runTscAlias`).

Today's coordinated path: open API program → run analyze → transform files → gather diagnostics through the API → **copy the whole source tree into `.esportsplus-tsc-*`** → write a tsconfig → spawn `tsc.js --noCheck` → compose source maps → copy outputs back → delete mirror → spawn `tsc-alias`. Today's passthrough path: spawn `tsc.js` (full check) → `runAnalyze` opens a *second* API program and checks everything again → spawn `tsc-alias`.

Plan:

1. **Unify the two paths.** Always open the API program once (it is needed for analyze anyway), gather diagnostics and run analyze there, then emit with `--noCheck`. The passthrough path stops double-checking; `template`'s 12 s `tsc --noEmit` becomes one check.
2. **Emit through the overlay instead of a mirror.** The tsgo API has no emit (confirmed in `dist/api/sync/api.d.ts`: only declaration-emit *diagnostics*), so a child `tsc.js` is still required. Avoid the full copy by writing only the *transformed* files into a mirror and pointing the child at the real tree via `files` + `rootDir`; untransformed files are read from their real path. If `tsc.js` cannot be made to read a mixed file list with a stable `rootDir`, keep the mirror but copy with `fs.cp` once instead of per-file `copyFileSync` + `mkdirSync`.
3. **Optional, bigger: emit with oxc.** `oxc-transform` (the transformer Rolldown/Vite 8 use) strips types and can emit `.d.ts` via `isolatedDeclarations` in milliseconds per file, with no child process. It requires `isolatedDeclarations: true` in `tsconfig.base.json`, which forces explicit types on exported declarations in every package. This is a style decision for the team; the plan should be read as "measure `tsc.js --noCheck` after step 1; if it is still the dominant cost, adopt oxc emit and `isolatedDeclarations`".
4. **Drop `tsc-alias` from the wrapper** (see TS-5). If step TS-5's consumer migration is not done yet, call `replaceTscAliasPaths()` from `tsc-alias` in-process instead of spawning a third Node process.
5. `--watch` stays unsupported on the plugin path (unchanged).

### TS-5. Remove `tsc-alias` and `~/` value imports

Files: `package.json` (`bin.tsc-alias`, `bin.esportsplus-tsc-alias`, dependency `tsc-alias`, `build` script), `tsconfig.base.json` (`tsc-alias` key), `bin/tsc-alias`, `src/cli/tsc.ts` (`runTscAlias`).

The coding standard says `~/` is for type-only imports; value imports must be relative. Counts of `~/` *value* imports today: typescript 33, reactivity 7, template 2, vite 11, routing 0, and the `ui` consumer 235. Once those are relative, `tsc-alias` has no job: `paths` still resolves type-only imports at check time and nothing needs rewriting after emit.

Public API impact: the `tsc-alias` / `esportsplus-tsc-alias` bins disappear and the `tsc` wrapper stops rewriting aliases. Consumers with `~/` value imports (ui: 235 of them) must convert first (a mechanical codemod: replace `~/x` with the relative path from the importing file). Call this out in the release notes; it is the one breaking change in this plan with a consumer-side action.

### TS-6. TypeScript 7.1: import path rename, no consumer impact

`typescript@7.1.0-beta` is published; stable is scheduled for 2026-11-24 (RC 11-10). The `unstable/` prefix is gone (`typescript/unstable/sync` → `typescript/sync`, same for `ast`, `ast/is`, `fs`, `async`), and the team commits to backward compatibility across 7.x after 7.1 stable. Watch/incremental/build-orchestrator APIs remain internal.

Files importing `typescript/unstable/*`: `src/ts.ts`, `src/cli/tsc.ts`, `src/compiler/{coordinator,imports,language-service,references,types}.ts`, `src/guard/adapter.ts`, `src/lsp/*`. Bump the pin to `7.1.x` when stable ships and rewrite the specifiers. Because every other package imports the compiler API through `@esportsplus/typescript`'s `ts` re-export, they need no code change, only a dependency bump. Re-run the API triage note from the 7.1 issue (some program/checker methods are still missing) against what `references`, `imports`, `guard` and `lsp` call.

### TS-7. Vite host plugin: native filters, build-mode result cache, dependency keys

File: `src/compiler/plugins/vite.ts`.

- Give `transform` the object form with `filter: { id: { include: /\.[cm]?[tj]sx?(?:\?|$)/, exclude: [/node_modules/, /^\0/] } }` so Rolldown's native filtering skips the JS callback entirely for assets, CSS and dependencies. Template's wrapper does this already; reactivity's own `compiler/vite` export does not.
- Add a build-only result cache keyed by `id` + content hash. The ui docs build spends 9.4 s in `vite:worker load`: the worker's nested bundle re-runs every plugin over the worker's module graph, which shares most of its files with the main graph, and every one of them is transformed again. With a cache the second pass costs a hash per file. Disable the cache in `serve` (HMR invalidation already handles that path).
- `closeBundle` disposes the language service; with worker sub-builds that fires while the parent build may still need it. Dispose on `buildEnd` of the outermost build only (track nesting with a counter, or dispose on `closeBundle` of the environment that opened it).
- `watchChange` resets the whole `contexts` entry (shared `Map`) for every file change. Keep per-file state in `dependents`/`relied` and only drop shared entries that depend on the changed file.

### TS-8. Language service hygiene

File: `src/compiler/language-service.ts`.

- `overlayFileSystem.getAccessibleEntries` scans every overlay key on each directory callback. Keep a `Map<directory, Set<file>>` index updated by `contents.set/delete` wrappers.
- `contains()` calls `api.parseConfigFile` (glob expansion over the project) on every membership miss and on every `invalidate` clearing `members`. Cache by config mtime, invalidate on `watchChange` of `tsconfig.json` only.
- `updateMany` compares overlay text with disk through `current()` → `fs.readFileSync` per file per transform. Cache disk text by `mtimeMs`.
- Make the scratch parser lazy per host (it already is) and document that a Vite build runs at most two tsgo processes after TS-2 (project + scratch).

### TS-9. `analyze` (tsc-guard) cost

Files: `src/guard/kernel/{analyze,graph,fixpoint}.ts`, `src/cli/tsc.ts`.

`analyze` runs a whole-program call-graph fixpoint on every `tsc` invocation and, on the passthrough path, builds its own program (TS-4 step 1 fixes the duplication). Beyond that:

- Add `--debug timings`-style instrumentation (`PACKAGE_NAME: analyze n files in x ms`) behind an env var so the cost can be measured per package; it is currently invisible inside the 12 s template typecheck.
- Persist per-file summaries (keyed by file content hash + overlay version) in `node_modules/.cache/@esportsplus/typescript/guard/` so an unchanged file's summary is reused across builds. The fixpoint only re-runs for files whose summary changed and their dependents.
- The `.dev.json` configs enable `exceptions` and `resources` over `test/**` and `bench/**`; the 67 findings in template are nearly all in tests (`Disposable` leaks in fixtures). Decide whether tests should be analyzed at all; excluding them halves the analyzed file count for every package.

### TS-10. Lint and format: adopt oxlint, hold oxfmt

There is no ESLint config anywhere in the five repos today; the only traces are stale `eslint-disable` comments in forked code (`vite/src/plugins/index.ts`, `vite/polyfills/shims/*`). So this is an addition, not a migration.

- Add `oxlint` (1.90) and `oxlint-tsgolint` (type-aware, needs TypeScript 7.0+, which the stack already pins) as devDependencies here and ship a shared `.oxlintrc.json` from this package (export it like the tsconfigs: `"./oxlintrc.json"`). Rules to enable beyond the defaults: `sort-imports`, `sort-keys` (alphabetized members are a house rule), `no-unused-vars` off (tsc's `noUnusedLocals` already gates it), `typescript/*` type-aware rules with `--type-aware`. `--type-check` can replace `tsc --noEmit` in `verify` for packages that do not use compiler plugins (it reports compiler errors from the same program); plugin packages keep the wrapper.
- Add `lint: oxlint --type-aware` to every package's `verify`, and a lint step to `.github/workflows/publish.yml` before `pnpm run verify` (the workflow is reused by all repos through `workflow_call`).
- **oxfmt (0.75, beta): do not adopt as a formatter.** It is Prettier-compatible by design and Prettier output conflicts with the coding standard in three ways it cannot be configured around: it collapses the double blank lines between file sections to one, it reflows comma-chained `let` declarations, and it reorders nothing (so alphabetization still needs the linter). Running it would rewrite every file in every repo. Revisit if oxfmt ships a `maxEmptyLines` option. Use `oxfmt --check` only as an experiment on a branch to see the diff size.

### TS-11. Dependency and tooling bumps

Policy for this and every other plan: at implementation time, **every** dependency and devDependency in the package moves to the latest published version (`pnpm up --latest`), not only the ones tabled below; the tables record what was current on 2026-11-03 and the known migration notes. Fix whatever breaks against our API rather than pinning back. Cross-package dependencies (`@esportsplus/typescript`, `@esportsplus/reactivity`, `@esportsplus/template`, `@esportsplus/vite`) point at the local checkouts (`link:` protocol) while the stack is being upgraded, and go back to published ranges on release.

| Package | Now | Latest | Action |
|---|---|---|---|
| `typescript` | 7.0.2 | 7.0.2 (7.1.0-beta, stable 11-24) | TS-6 when stable |
| `vite` (dev) | ^8.3.0 | 8.3.5 | bump |
| `vitest` | ^5.0.1 | 5.1.0 | bump; new `--last-failed` / `--since-last-run` are useful for `agent:test` |
| `tsc-alias` | ^1.9.5 | 1.9.10 | remove (TS-5) |
| `vscode-languageserver` | ^10.1.1 | 11.0.0 | bump; check the `createConnection` signature change in the 11 changelog for `src/lsp/server.ts` |
| `@types/node` | ^26.6.2 | 26.6.6 | bump |
| pnpm | 11.10.0 (`packageManager`) | 12.16.1 | evaluate pnpm 12 in this repo first (publish workflow validates `packageManager`), then propagate the exact pin to the other four `package.json` files, which currently have none and fall back to the workflow's "legacy" 11.10.0 |
| `engines.node` | absent | | add `"node": ">=26"` (the publish workflow warns and falls back to 26.8.1) |

### TS-12. Small cleanups

- `src/compiler/sourcemap.ts` `resolveOffsets` uses `const` locals and no blank lines after blocks; align with the standard when touched.
- `src/guard/**` uses `const` for locals and a different layout from the rest of the package (it reads as a separately authored module); fold into the standard opportunistically, not as a dedicated pass.
- `pnpm-workspace.yaml` `minimumReleaseAgeExclude`: keep only the `@esportsplus/*` wildcard and non-first-party entries that are still needed; the per-version lists are stale after each bump.
- `README.md`: document `generate(sourceFile, text)` (TS-2), the removal of `tsc-alias` (TS-5), the single-check `tsc` flow (TS-4), the lint setup (TS-10).

## 3. Public API changes (summary)

| Change | Kind | Why it is worth it |
|---|---|---|
| `ReplacementIntent.generate(sourceFile, text)` second argument | additive | enables single-program composition (TS-2), removes a tsgo process and half the checker traffic |
| `tsc-alias` bins and auto-run removed | breaking | one fewer process per build, one fewer dependency, enforces the existing import standard; consumer codemod required |
| `TransformContext.checker` is a memoizing proxy | behavioural, type-compatible | shared cache across plugins (TS-3) |
| `typescript/unstable/*` → `typescript/*` | internal | no consumer impact thanks to the `ts` re-export |

Everything else (CLI flags, `plugin.vite` options, `languageService` exports, tsconfig presets, LSP) is unchanged.

## 4. Order of work

1. TS-1 (references candidates) — self-contained, biggest win, unblocks nothing else.
2. TS-3 (shared checker proxy) — small, pairs with TS-1 measurements.
3. TS-7 (vite host filters + build cache) — self-contained.
4. TS-2 (composition) together with template `T-2` — one coordinated release of typescript + template.
5. TS-4 / TS-5 (`tsc` wrapper + tsc-alias removal) with the relative-import codemod in all five packages and `ui`.
6. TS-10 (oxlint) and TS-11 bumps; TS-6 when 7.1 is stable.
7. TS-8, TS-9, TS-12 as follow-ups once the above are measured.

Re-run the ui docs profile (`node --cpu-prof node_modules/vite/bin/vite.js build`) after steps 1–4 and record the new `PLUGIN_TIMINGS` line here.

## 5. Implementation notes (2026-11-03, branch `upgrade/stack-2026-11`, 22 commits, not pushed)

Implemented: TS-1, TS-2, TS-3, TS-4, TS-5, TS-7, TS-8, TS-9 (instrumentation + whole-program findings cache), TS-10 (oxlint only), TS-11, TS-12. Skipped: TS-6 (TypeScript 7.1 is still beta on npm); oxc emit / `isolatedDeclarations` (measured `tsc.js --noCheck` emit at 236 ms, not worth it). Gate: build, typecheck, lint, 442 tests, benches.

Decisions taken during implementation:

- `tsc-alias` removal needed two extra pieces: `.d.ts` keeps `~/` type imports verbatim, so every import in `src/` of a declaration-emitting package is relative (a test enforces it, the wrapper fails the build if an alias survives into emitted output); and `resolveFullPaths` was adding `.js` extensions, so `src/cli/specifiers.ts` is a dependency-free post-emit pass over the files tsc lists as emitted.
- TS-1 kept one more case than planned: `html` reached through a parameter typed as a module (`(B: typeof import('./barrel')) => B.tag\`\``), caught by template's suite. Import-rooted pruning sends 192 instead of 989 identifiers per fixture file (−81%).
- TS-2: `generate(sourceFile, text)`; `prepend` entries may be `(text) => string`, evaluated after composition; order is transform → compose → per-plugin prepend + imports, documented on `TransformResult`. `text()` binary-searches nested intents (7.51 → 1.20 ms on 4000 intents / 2000 calls).
- TS-3: `checker.cached` also memoizes type-keyed queries (`isArrayType`, `isTupleType`, `getPropertyOfType`, `getNonNullableType`, `getBaseConstraintOfType`, `getSignaturesOfType`, `getTypeArguments`, `isTypeAssignableTo`) by `type.id`; ids are stable within a snapshot. Round-trips on the fixture: 79 → 43 first pass, 0 after.
- TS-4: passthrough and plugin paths unified on one API program; the mirror directory stays (tsc needs one `rootDir`) but hard-links untouched files. `tsc --noEmit` on template: 7.7 → 7.5 s cold, 1.85 s with a warm analyze cache. Analyze is ~80% of a typecheck (call graph 1.3–1.7 s, 1–2 s per channel): next target, needs a dependency-aware per-file cache (see TS-9 discussion: summaries depend on imported types and program-wide call-graph roots).
- TS-7: filter is `/\.[cm]?[tj]sx?$/` (query ids were never compiled); build cache and nesting counter are process-wide because template creates a factory per instance.
- TS-10: `oxlintrc.json` exported; `sort-imports` `ignoreCase: true`, `sort-keys` `caseSensitive: false`. oxfmt not adopted.

Public API changes shipped: `tsc-alias` bins removed; host plugin `transform` is `{ filter, handler }`; host compiles `.mts/.cts/.mjs/.cjs`; `generate(sourceFile, text)`; `languageService.stage` and `configPath` removed; `checker`, `Prepend`, `Text`, `Plugin.name` added; `ESPORTSPLUS_TIMINGS`, `ESPORTSPLUS_ANALYZE_CACHE` env vars.

Consumer-side evidence (ui docs build, same machine, final run with sass-embedded): wall time 40.8 → 15.1 s, bundle 28.8 → 12.8 s, template transform 20.3 s / 336 calls → 10.6 s / 369 calls, worker sub-build 9.4 → 3.5 s, library scss build 3.1 → 0.6 s.

## 6. tsc-guard investigation (2026-11-03, after the upgrade)

Measured on G:/template (`ESPORTSPLUS_TIMINGS=1`, analyze cache off; 162 project files, 545 program files, 67 findings): analyze 5.8 s of a 7.5 s typecheck — call graph 1.5 s, exceptions 1.0 s, resources 1.0 s, async 2.2 s. A CPU profile attributes ~5.0 s of that to synchronous tsgo IPC. A counting proxy on the checker shows 108k round-trips with heavy duplication:

| method | calls | unique key | time |
|---|---|---|---|
| getSymbolAtLocation | 41,862 | 19,876 nodes | 1,947 ms |
| getTypeAtLocation | 18,717 | 17,311 nodes | 947 ms |
| getApparentType | 16,016 | 718 types | 516 ms |
| getPropertyOfType | 16,016 | 671 types | 480 ms |
| getPropertiesOfType | 2,190 | 249 types | 441 ms |
| getAliasedSymbol | 5,637 | 673 symbols | 219 ms |
| getReturnTypeOfSignature / getSignaturesOfType | 3,269 / 3,279 | ~all unique | 270 ms |
| program.getSourceFile | 1,090 | | 137 ms (materializes every lib `.d.ts`) |

Hot callers: `graph.ts calleeSymbol` (per call site), `async/channel.ts isPromiseType` / `producesPromise` / `returnsPromise` (per call and per function per fixpoint round), `exceptions/channel.ts detectParamCall`, `resources/channel.ts hasDispose`, `adapter.ts getSourceFiles`.

Plan being implemented on branch `perf/guard-round-trips` (worktree G:/typescript-guard), gated by a golden test that pins every finding of template, reactivity, routing and this repo byte-for-byte: (1) wrap the analysis checker in `checker.cached` extended with `getApparentType`, `getPropertiesOfType`, `getAliasedSymbol`, `getReturnTypeOfSignature`; (2) batch `getSymbolAtLocation`/`getTypeAtLocation` per file in the graph build so channel visitors hit the cache; (3) filter program file names before materializing source files; (4) cache `returnsPromise` per function and `isPromiseType`/`hasDispose` per `type.id`; (5) report round-trips per phase under `ESPORTSPLUS_TIMINGS`. Target: round-trips in the hundreds, analyze well under 2 s on template. The dependency-aware per-file summary cache stays a follow-up; this work removes most of what it would have saved.

Result (branch `perf/guard-round-trips`, merged into `main` as `3df66b1 feat(guard)`): analyze on template 6.3 s → 1.6 s (call graph 1.4 → 0.78 s, exceptions 1.1 → 0.25 s, resources 1.05 → 0.16 s, async 2.3 → 0.38 s), round-trips 108,136 → 9,633; on this repo 2.9 s → 0.98 s. Real `tsc --noEmit` on template with the analyze cache off: 6.6 → ~2.9 s. Findings byte-identical on template (67), reactivity (30), routing (0) and the frozen self archive (27); `test/guard/golden.test.ts` keeps the self pin hard and skips sibling pins whose sources drifted. What remains is `returnsPromise` (signature + return type per function, ~6.5k round-trips, no batch form in the API) — the next step if async still dominates. `ESPORTSPLUS_TIMINGS=1` now prints round-trips per phase.

## 7. Implementation notes (round 2) (2026-11-03, branch `perf/guard-followups`, 3 commits, not pushed)

### `returnsPromise` round-trips

`src/guard/async/returns.ts` decides from syntax first and only asks the checker for what syntax can't settle: an `async` modifier ⇒ true; a `Promise<T>` annotation (identifier text, one type argument, file declares no `Promise` binding of its own) ⇒ true; a primitive / `void` / `never` / type-predicate annotation ⇒ false; a block body with no `return <expr>` outside nested functions ⇒ void ⇒ false; a concise arrow returning a literal (string, number, bigint, boolean, template, regex, array, or an object literal with no spread, computed name or `then` member) ⇒ false. Excluded: accessors, constructors, generators, JavaScript files (JSDoc can declare the return type), `any`/`unknown`/`object`/`null` annotations, and any function/method whose name symbol has more than one declaration. That last check covers overloads and class/interface merging, where the checker answers from another declaration's signature. Name symbols ride the existing per-file `getSymbolAtLocation` batch in `graph.ts prefetch`, so the check is free. Item 1(b) was already in place from round 1: `prefetch` batches `getTypeAtLocation` of every non-async function per file. 7.0.2 has no array form for `getSignaturesOfType` / `getReturnTypeOfSignature`, so those two stay per function for the residue. Assumption: lib's `String`/`Number`/`Boolean`/`Array`/`RegExp` are not augmented with a `then` member. `test/guard/async/returns.test.ts` checks the syntactic answer against the checker on 39 functions: every case in the brief plus shadowed `Promise`, class/interface merge, JSDoc'd JS, throw-only arrow, spread/`then` object literals, `asserts`, `any`, `null`, and overloads with a keyword implementation.

| G:/template, analyze cache off | before | after |
|---|---|---|
| async phase round-trips | 7,933 | 3,578 (−55%) |
| `getSignaturesOfType` + `getReturnTypeOfSignature` | 6,544 | 2,240 |
| analyze round-trips | 9,469 | 5,114 (−46%) |
| async phase, median of 5 | 485 ms | 296 ms |
| analyze, median of 5 | 1,675 ms | 1,576 ms |
| `tsc --noEmit` wall | ~3.0–3.1 s | ~3.0–3.1 s (inside noise) |

Elsewhere: this repo async 4,371 → 2,225 and analyze 5,375 → 3,230 round-trips (1,105 → 1,041 ms); reactivity async 4,184 → 1,772 and analyze 4,956 → 2,544 (811 → 709 ms). A round-trip costs ~0.04 ms here, so −4.3k round-trips is ~0.2 s at best. The rest of a typecheck is now the call graph (~0.8 s) and the compiler's own diagnostics. On template 1,127 functions still need the checker, mostly concise arrows returning a call (316) or a tagged template, and block bodies with real returns. Findings are byte-identical against a baseline (main) build on template (67), reactivity (30), routing (0) and this repo (32). With all four golden pins temporarily re-recorded by the baseline build, the changed code passes all four; the sibling pins were then restored (their sources have drifted, so they skip).

Golden fix (`test(guard)` commit): the frozen self archive is extracted once into `%TEMP%` and shared by every checkout. Its `node_modules` junction still pointed at the removed `G:/typescript-guard` worktree, and since `%TEMP%` (C:) and the repo (G:) are on different drives, `self.json` had pinned absolute `G:/typescript-guard/...` paths. The self pin therefore failed from `G:/typescript`, `main` included. The test now re-points a stale junction and pins paths it cannot make relative as `<repo>/…`. Re-recorded with the baseline build: only those two path prefixes changed.

Tests stay analyzed under the `.dev` presets (README, tsc-guard section).

### TypeScript 7.1.0-beta trial (branch `trial/ts-7.1`, 1 commit, not for merge)

- Export map: `unstable/*` is gone with no alias: `typescript/{sync,async,fs,proto,ast,ast/is,ast/factory,ast/utils,ast/scanner,ast/visitor,ast/clone}`; new `typescript/path` (branded `RootedFilePath`/`PathKey` helpers), `typescript/vscode`, `typescript/schemas/*.json`. 28 files changed (specifier rewrite plus ~40 lines of real changes).
- API moves: `api.updateSnapshot` is private, replaced by `api.createSnapshot(params)` and `snapshot.update(params)`. `update` hands back the **same** snapshot object when nothing changed, so dispose-the-old logic must compare identities. `fileChanges` became `fileNotifications`. `snapshot.getProject(string)` takes a `ProjectId`; use `getConfiguredProject(configFileName)`. `typescript/fs`'s `FileSystem` became `FileSystemCallbacks`: every member is required, and a fall-through is now `serverFS.useOS` (returning `undefined` from `readFile` now means *absent*, which would hide lib files). `CompilerOptions` is a closed generated interface (no index signature). `SourceFile.fileName`/`Diagnostic.fileName` are branded `RootedFilePath`.
- Beta behaviour to re-check at RC: `snapshot.update({ fileNotifications: { changed } })` returns a new snapshot whose program still holds the **old** text; it refreshes only when the project is listed again in `openProjects`. A `fileSystem` layer passed to `update` was not applied either. The trial passes `openProjects` on every update.
- **Breaking for plugins:** `SyntaxKind` is renumbered (197 of 386 members shift by one from `QualifiedName` on; `NodeFlags`/`ModifierFlags` unchanged). A plugin that loads its own 7.0 AST module under a 7.1 host misreads every node and silently transforms nothing. Seen live: template's `tsc --noEmit` through the 7.1 host reports "transform 0 of 162 files changed" (32 under 7.0), because published reactivity 0.41 brings `@esportsplus/typescript` 0.39 / TS 7.0.2. Diagnostics and findings still matched only because the untransformed code also type-checks. Host, plugins and consumers must move together, with one deduped `typescript`.
- Results: typecheck and lint green; 468/469 tests. The one failure is the self golden pin: 23 of 27 findings identical, and the 4 missing ones sit on `api.updateSnapshot` calls in the frozen 7.0 sources, which no longer type as a disposable `Snapshot`. Findings and compiler output byte-identical to 7.0.2 on template (67), reactivity (30), routing (0). With `@esportsplus/typescript` aliased out-of-tree to each build (copied vitest config; template also inlines `@esportsplus/reactivity` so both share one TS), reactivity passes 502/502 and template 1688/1688 (+1 skipped) on both 7.0.2 and 7.1. A bogus alias target fails 5 and 25 files respectively, which proves the alias was in effect.
- `oxlint-tsgolint` 7.0.2005 keeps working: lint is green, and its embedded 7.0.2 checker reads 7.1's declarations (reports `updateSnapshot` as private, TS2341). It would not understand 7.1-only language features until it ships a 7.1 build.
- Performance, same program under both compilers (5 runs, medians): routing diagnostics 221 → 175 ms (−21%), analyze 428 → 448 ms (+5%), wall 1,219 → 1,162 ms; this repo diagnostics 176 → 166 ms (−6%), analyze 948 → 1,148 ms (+21%), wall 1,613 → 1,783 ms. The checker is faster; per-request API calls (what analyze makes) are slower.
- Batch API: every method gains a `.gen(...)` generator form, and `api.batch(...generators)` runs them in one round-trip. Prototype on template's 1,127 residual functions: `getSignaturesOfType.gen` ×1,127 then `getReturnTypeOfSignature.gen` ×1,127 in 2 batches took 5 ms against 125 ms for 2,254 sequential round-trips, with identical answers (the sequential pass ran first, so server-side caches may favour the batch; IPC dominates either way). Adopting it needs `checker.cached` to pass `.gen` through.
- Emit and parse APIs: `program.emit()`, `emitToString()`, `getJavaScriptEmit(files)`, `getDeclarationEmit(files)` (emitting ignores `noEmit`); `api.createProgram`, `api.transpileModule`/`transpileDeclaration`, and `api.createSourceFile` (a standalone parser: replaces derive's one-file virtual project). Build orchestrator APIs exist in the protocol but remain internal.
- **Verdict: wait for 7.1 stable (2026-11-24), then adopt.** The port is small and known, and the trial branch is ready to rebase. Reasons to wait: the `snapshot.update` staleness is a beta bug or an undocumented contract; the `SyntaxKind` renumbering forces one coordinated release of typescript, reactivity, template, vite and ui; and without `api.batch` analyze gets 5–21% slower. At stable: rebase the trial, re-test `update` without `openProjects`, move the guard's residual signature queries (and the graph prefetches) onto `api.batch`, evaluate `program.emit` to replace the `tsc.js --noCheck` subprocess and mirror directory, replace derive's virtual project with `createSourceFile`, and release all `@esportsplus/*` packages together.

### pnpm 12.16.1 (evaluated in scratch copies, not switched)

- Corepack isn't bundled with Node 26; use `npx pnpm@12.16.1` or `pnpm/action-setup`. While `packageManager` says `pnpm@11.10.0`, a pnpm 12 binary delegates to 11.10.0, so a test that leaves `packageManager` alone tests nothing.
- Lockfile: still `lockfileVersion: '9.0'`, and the dependency document is untouched. But pnpm 12 records itself in a new leading YAML document (`packageManagerDependencies: pnpm 12.16.1` plus `@pnpm/exe.*` integrity entries, ~158 lines). After switching `packageManager`, `pnpm install --frozen-lockfile` **fails** (`ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE`: cannot update packageManagerDependencies) until one non-frozen install or `pnpm install --lockfile-only` writes that document. Reproduced on this repo's and reactivity's lockfiles. Afterwards, frozen installs pass, and pnpm 11.10.0 reads the two-document lockfile without complaint.
- `allowBuilds` still applies: with it, esbuild's postinstall runs; without it, `ERR_PNPM_IGNORED_BUILDS`. `minimumReleaseAgeExclude` still applies: with a huge `minimumReleaseAge`, 112 of 115 entries fail with the excludes and 115 of 115 without. Store format unchanged (`v11`).
- Publish workflow: the `packageManager` regex `^pnpm@\d+\.\d+\.\d+(?:[-+].*)?$` accepts `pnpm@12.16.1`, and `action-setup` then installs it. The following `pnpm install --frozen-lockfile` step fails unless the lockfile with the env document is committed together with the `packageManager` bump.
