# @esportsplus/routing — upgrade and performance plan

Status: plan only, nothing implemented. Written 2026-11-03 against `@esportsplus/routing@0.11.8`.

Routing is the smallest package in the stack (1 029 lines of source, client only) and a pure consumer of the others: it uses `reactive`/`effect`/`root` from reactivity at runtime and the reactivity tsc plugin at build time. Nothing in it showed up in the build profile. Items are `RT-n`; cross-references are `TS-n` (typescript plan) and `R-n` (reactivity plan).

## 1. Where it stands

| Dependency | Pinned | Latest / target |
|---|---|---|
| `@esportsplus/reactivity` | ^0.40.0 | current |
| `@esportsplus/typescript` (dev) | ^0.37.0 | 0.38.0 now; the TS-1..TS-5 release next |
| `@types/node` | ^26.6.2 **in `dependencies`** | 26.6.6, move to `devDependencies` |
| `happy-dom` (dev) | ^20.14.5 | 21.0.4 |
| `vitest` (dev) | ^5.0.1 | 5.1.0 |

Build: `tsc -p tsconfig.build.json` with the reactivity transformer, so every build goes through the coordinated path (API program + mirror emit + `tsc-alias`). No `~/` value imports.

## 2. Changes

### RT-1. Dependency hygiene

File: `package.json`.

- Dependency policy as in TS-11: every dependency to latest (`pnpm up --latest`), fix breaks, `link:` the local `@esportsplus/typescript` and `@esportsplus/reactivity` during the upgrade.
- `@types/node` is a runtime dependency of a browser-only library. Consumers get Node types through `@esportsplus/typescript`'s presets already; move it to `devDependencies`.
- `@esportsplus/typescript` ^0.37.0 → ^0.38.0 now, then to the release carrying TS-1/TS-3 (faster coordinated builds) and TS-4/TS-5 (single check, no `tsc-alias`; routing has no alias imports so nothing to convert).
- `happy-dom` 21, `vitest` 5.1.0.
- Add `verify` (`build && tsc --noEmit && lint && test`), `packageManager`, `engines.node` for the shared publish workflow (TS-11), and `lint: oxlint --type-aware` (TS-10).
- `pnpm-workspace.yaml`: keep the `@esportsplus/*` wildcard and the `happy-dom`/`vitest` entries that are still younger than the release-age gate; drop the per-version reactivity/typescript lists.

### RT-2. Build path

Files: `tsconfig.json`, `tsconfig.build.json`.

No change to the configs; the package inherits TS-4 (no double type-check, no full mirror copy) and TS-5. Once oxlint's `--type-check` is in place and if routing stays plugin-free apart from the reactivity transformer, `tsc --noEmit` in `verify` still has to be the `@esportsplus/typescript` wrapper, because the reactivity plugin changes what the checker sees (`reactive()` calls are lowered). Keep the wrapper; do not replace the typecheck with `oxlint --type-check` here.

### RT-3. Runtime micro-items (only with a bench delta)

Files: `src/client/index.ts`, `src/client/router/index.ts`, `src/client/router/node.ts`.

Nothing here is a measured hotspot; `bench/` exists and should be the gate. Candidates, each a few lines and API-neutral:

- `Router.uri()` splits `route.path` on every call; precompute the segment list per route at `register()` time and store it on the `Route`.
- `middleware().match()` builds one `reactive` + `effect` per router; `update()` assigns eight fields on every request object on each navigation, which triggers up to eight reactive writes. Batch them with reactivity's batching primitive if 0.40 exposes one (`R-6` records the runtime surface), otherwise leave.
- `match()` normalizes the path on every call; `href()` already produces a normalized `pathname`, so `normalize()` can be skipped when the input comes from `href()`.

Record `pnpm bench` before and after; drop any item that does not move the numbers.

### RT-4. Types

File: `src/client/types.ts` (307 lines of template-literal route typing: `AccumulateRoutes`, `ValidateFactories`, `RegisterPaths`, …).

These types are evaluated by consumers' editors and by tsgo on every check of a consumer that registers routes. TypeScript 7's native checker makes this cheap in absolute terms, but the `tsc --noEmit` of a large consumer app is the place to look if route registration ever becomes a typecheck hotspot (tsgo's `--extendedDiagnostics` shows check time per file). No change planned; noted so it is not forgotten when TS 7.1's checker lands.

## 3. Public API changes

None. `router()`, `middleware`, `redirect`, `uri`, `back`/`forward`/`shutdown`, the `Router` builder surface and the `./client` export are unchanged.

## 4. Order of work

1. RT-1 (dependency moves and bumps) — one PR, any time.
2. RT-2 follows the typescript releases automatically.
3. RT-3/RT-4 only if the bench or a consumer typecheck shows a reason.

## 5. Implementation notes (2026-11-03, branch `upgrade/stack-2026-11`, 6 commits, not pushed)

Implemented: RT-1, RT-2, RT-3 (`uri()` segment precomputation only: +21% static, +31% two params, +51–55% optional/wildcard; `match()` unchanged within noise). Gate: `verify` green, 64 tests, bench runs. Two pre-existing breakages fixed: the bench imported the removed vitest `bench` export and had no `bench` script; `tsc --noEmit` failed on a type test because `redirect()` accepted only route names while the runtime already handles URLs. Decision: `redirect`'s type now also accepts `${string}://${string}` with no params (additive public type change, JS unchanged). Build output byte-identical to the pre-upgrade build apart from reordered import specifiers.
