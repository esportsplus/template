# @esportsplus/vite — upgrade and performance plan

Status: plan only, nothing implemented. Written 2026-11-03 against `@esportsplus/vite@0.14.8`.

`@esportsplus/vite` wraps Vite for every SPA: `config()` applies house defaults, registers the tsconfig `paths` plugin, and exposes `use(p)` to opt into `favicons`, `html.minify`, `images`, `svg`, `css` and `node.polyfills`. It is the most out-of-date package in the stack and the one with the most third-party weight. Items are numbered `V-n`; the typescript plan is referenced as `TS-n`.

## 1. Where it stands

| Dependency | Pinned | Latest | Notes |
|---|---|---|---|
| `vite` | ^8.3.0 | 8.3.5 | `resolve.tsconfigPaths` stable since 8.2.0; `transformWithOxc` still exported |
| `@esportsplus/typescript` | ^0.36.0 | 0.38.0 | two minors behind; only used for `tsc`/tsconfig presets |
| `sass` | ^1.104.1 | 1.107.1 | Vite prefers `sass-embedded` when installed; the Dart-JS `sass` was 4.6 s of the ui docs build profile |
| `svgo` | ^4.0.2 | 4.1.0 | |
| `html-minifier-terser` | ^7.2.0 | 7.2.0 | unmaintained since 2023, pulls terser + clean-css |
| `favicons` | ^7.3.1 | 7.3.1 | sharp-based, re-renders every build |
| `vite-plugin-image-optimizer` | ^2.0.3 | 2.0.3 | |
| `micromatch`, `@xmldom/xmldom`, `npm-run-all`, `node-stdlib-browser`, `buffer`, `process` | | | see V-6, V-7 |
| `vitest` (dev) | ^5.0.1 | 5.1.0 | `vitest.config.ts` uses `__dirname` in an ESM file; replace with `import.meta.dirname` |

Observed in the ui docs production build (`PLUGIN_TIMINGS`): `@esportsplus/vite:svg.build transform` was invoked 1091 times, once per module of the whole graph, because the hook has no filter. The sprite itself is 167 icons inlined into `index.html` on every page.

## 2. Changes

### V-1. Delete the `paths` plugin; use Vite's native `resolve.tsconfigPaths`

Files: `src/plugins/paths.ts` (136 lines), `src/config.ts`, `src/index.ts` (`paths` export).

Vite 8 resolves tsconfig `paths`/`baseUrl`/`extends` natively, including inside CSS and Sass `@import` (8.1.1) and in the dependency scanner, which is exactly the case the hand-written plugin's comment and the ui docs config (`PATH_ALIASES` "Vite's dev glob resolver needs aliases before configResolved runs") work around. `config()` sets `resolve: { tsconfigPaths: true }` and drops the plugin.

Public API impact: the `paths` named export is removed (breaking). Only consumers that import it directly are affected; ui docs builds its own alias list and can delete it along with the workaround. Net: -136 lines here, -20 lines in ui docs, one fewer `resolveId` hook per import.

### V-2. SVG: external, hashed, cacheable sprite instead of inlining into `index.html`

Files: `src/plugins/svg/index.ts`, `src/plugins/svg/runtime.ts`, `src/types.ts` (`SvgOptions`), `package.json` (`./svg/runtime.js` export).

What is wrong with the current approach:

- The whole sprite (every icon any module imported) is written into `<body>` of every HTML entry. It is downloaded with the document on every navigation that reloads, it cannot be cached independently of `index.html`, and it is parsed before first paint even when the route uses three icons.
- The `transform` hook has no `filter`, so it runs for every module (1091 calls) and does a `micromatch.isMatch` per call.
- It runs as `transform` *after* Vite's asset `load` has already read the file and produced `export default "/assets/x.svg"`, so each SVG is read twice and the `?url`/`?raw` queries are not distinguished.
- `svgo` + an xmldom parse/serialize run on every build with no cache.

Options considered:

| Option | Caching | Styling | First paint | Requests |
|---|---|---|---|---|
| A. Inline sprite in HTML (today) | none; re-sent with HTML | full (document CSS reaches inner nodes) | sprite blocks parse | 0 |
| B. External sprite file, `<use href="/assets/sprite.[hash].svg#id">` | immutable, hashed, shared across pages/deploys | inherited properties only (`currentColor`, `fill`/`stroke`, custom properties inherit through the `<use>` shadow tree); document selectors cannot reach inner nodes | not blocking; icons appear when the sprite arrives (one request, preloadable) | 1 |
| C. Fetch sprite at runtime and inject into `<body>` | same as B | full (becomes inline once injected) | icons blank until fetch completes; needs a runtime | 1 |
| D. Per-chunk sprites (icons grouped by the chunk that imports them) | hashed | as B | smaller first sprite | 1 per chunk |

Recommendation: **B**, with A's dev-mode runtime kept for HMR. It is what `<use>` was designed for, needs no runtime, works in every supported browser for same-origin files, and the only consumer in the stack (`@esportsplus/ui` `icon` component) already passes the imported value straight into `<use href>`, normalising a missing `#`. The styling limitation is acceptable because the sprite's `<symbol>`s are already stripped to `SVG_PRESERVE_ATTRIBUTES` and coloured through `currentColor`. If a consumer ever needs document CSS inside an icon, that icon should be an inline `html\`<svg>…\`` template, which the template compiler already supports. C can be offered later as `svg({ mode: 'inject' })` without touching B.

Implementation outline (Rolldown 1.2.x has `emitFile`, `getFileName`, `renderStart` and `renderChunk`, but no `setAssetSource`, so the asset is emitted once all modules are known and the URL is patched into chunks):

1. Replace the `transform` hook with a `load` hook, `enforce: 'pre'`, with `filter: { id: /\.svg$/ }` (query-less ids only; `?url`, `?raw`, `?inline` fall through to Vite). Read the file once, svgo it, build the `<symbol>` with svgo's own AST (a tiny custom svgo plugin: rename root `svg` → `symbol`, keep preserved attributes, add `viewBox` from width/height) and drop `@xmldom/xmldom` and `micromatch` (`SVG_PRESERVE_ATTRIBUTES` becomes a regex list).
2. Cache the optimized symbol on disk keyed by content hash under `node_modules/.cache/@esportsplus/vite/svg/` so unchanged icons cost one hash per build.
3. Build: the module becomes `export default __ESPORTSPLUS_SVG_SPRITE__ + '#' + id; export { attributes };`. In `renderStart`, concatenate every loaded symbol into one sprite, `emitFile({ type: 'asset', name: 'sprite.svg', source })`, and in `renderChunk` replace the placeholder with the asset's base-relative URL from `this.getFileName(ref)` (the same pattern Vite uses for its own `__VITE_ASSET__` placeholders). Add `<link rel="preload" as="image" type="image/svg+xml">` for the sprite in `transformIndexHtml` so it is fetched in parallel with the entry chunk.
4. Serve: keep the current per-module runtime injection (`runtime.ts`) and `export default '#' + id`, so HMR of a single icon keeps working and no sprite endpoint is needed.
5. `attributes` export and `moduleSideEffects` option stay; `include` keeps its string/array form but is matched with a regex built once.

Public API impact: the default export of an `.svg` module changes from `"<hash>"` to `"/assets/sprite.<hash>.svg#<hash>"` in builds (`"#<hash>"` in dev). Consumers that prefix `#` themselves must stop doing so; `ui/src/components/icon` already handles both. Document in README under SVG.

### V-3. Replace `html-minifier-terser`

File: `src/plugins/html.ts`.

Vite 8 already minifies inline `<style>` through Lightning CSS (8.3.0) and inline module scripts through oxc; `html-minifier-terser` re-minifies them with terser and clean-css on every build, is unmaintained, and is the heaviest install in the package. Replace with `@minify-html/node` (Rust, same job, orders of magnitude faster) behind the same `p.html.minify(options)` call; map the four options the config sets today (`collapseWhitespace`, `removeComments`, `collapseBooleanAttributes`, `minifyCSS`/`minifyJS` off). Keep the `apply: 'build', enforce: 'post'` placement.

### V-4. Cache favicons and move the image cache out of the output directory

Files: `src/plugins/favicons.ts`, `src/plugins/images.ts`.

- `favicons()` re-renders every icon size through sharp on every build and `transformIndexHtml` splices tags with a string `replace`. Cache the generated files + html tags under `node_modules/.cache/@esportsplus/vite/favicons/<logo content hash>/<options hash>` and emit them with `this.emitFile`; use the `transformIndexHtml` tag-array form (`{ tag, attrs, injectTo: 'head' }`) instead of string replacement.
- `images()` sets `cacheLocation: 'build/cache'`, which is *inside* the production `outDir` (`build`). `emptyOutDir` wipes it every build (so the cache never hits) and whatever survives would be deployed. Move it to `node_modules/.cache/@esportsplus/vite/images`.

### V-5. Sass: depend on `sass-embedded`

File: `package.json`.

Vite picks `sass-embedded` automatically when it is resolvable (checked in `vite/dist/node/chunks/node.js`). It is the Dart VM binary with the same API, several times faster than the JS build, and 4.6 s of the 31 s profiled ui docs build was inside `sass.dart.js`. Swap the dependency; consumers that pin `sass` themselves (ui does) can drop it.

### V-6. Polyfills: one shim build, no `npm-run-all`

Files: `package.json` scripts, `polyfills/shims/vite.config.ts`, `src/plugins/polyfills/*`.

- `build:shims` runs three Vite processes in parallel through `run-p`, one per shim. One `vite build` with `lib.entry: { buffer, global, process }` produces the same three outputs in one process; `npm-run-all` is then unused and removed (`build` becomes `tsc && vite build -c polyfills/shims/vite.config.ts`).
- The plugin code is sound for Vite 8 (`transformWithOxc`, `transform.filter`, rolldown `inject`). Keep. Remove the two stale `eslint-disable` comments in the shims and the one in `plugins/index.ts` when oxlint arrives (TS-10).
- `polyfills/shims/package.json` and the per-shim `package.json`s duplicate the export maps in the root `package.json`; keep only the root map (the `./polyfills/shims/*/` trailing-slash entries are a pre-Node-17 pattern and can go).

### V-7. `config()` defaults

File: `src/config.ts`.

- Set `resolve.tsconfigPaths: true` (V-1).
- Production: Rolldown warned during the ui build to set `build.rolldownOptions.output.codeSplitting`; expose it through `config.build` as today (no default change) but mention it in the README. Keep hashed `assets/[hash]` names, `sourcemap: false`.
- `mode === 'production'` is read from the *user* config; `vite build` without `--mode` leaves `config.mode` undefined and the dev branch runs (`sourcemap: true`, `server.open: true`). Switch to the `defineConfig((env) => …)` form so `env.command`/`env.mode` decide, and keep `config(base)` returning that function. Public signature unchanged for callers that already pass `mode`.
- `css.transformer: 'lightningcss'` default stays (`css.ts`).

### V-8. Tests and tooling

- Dependency policy as in TS-11: every dependency to latest (`pnpm up --latest`), fix breaks against our API, `link:` the local `@esportsplus/typescript` during the upgrade.
- `vitest` 5.1.0, `@esportsplus/typescript` 0.38 → next (gets the single-check `tsc`, TS-4), `vite` 8.3.5, `svgo` 4.1.0, `@types/node` 26.6.6.
- `vitest.config.ts`: `__dirname` → `import.meta.dirname`.
- Add `verify` (`build && typecheck && lint && test`) and `packageManager`/`engines.node` (see TS-11).
- Convert the 11 `~/` value imports in `src/` to relative imports ahead of TS-5.
- Add `oxlint` per TS-10; the forked polyfill code has the only lint-suppression comments in the stack.
- `pnpm-workspace.yaml`: `allowBuilds` for `sharp`/`esbuild`/`@parcel/watcher` stays; prune the stale `minimumReleaseAgeExclude` version lists to the `@esportsplus/*` wildcard.

## 3. Public API changes (summary)

| Change | Kind | Why |
|---|---|---|
| `paths` export removed; `resolve.tsconfigPaths` set by `config()` | breaking | 136 lines replaced by a stable Vite option that also fixes dev-time glob/CSS alias resolution |
| `.svg` default export becomes a sprite URL + fragment in builds | breaking | sprite becomes an immutable cached asset instead of HTML payload on every page |
| `config(base)` decides mode from the Vite env, not only `base.mode` | behavioural | `vite build` without `--mode` no longer produces a dev-flavoured bundle |
| `html.minify` backed by `@minify-html/node` | internal | removes an unmaintained, slow dependency; options surface kept |

`use(p)`, `p.css()`, `p.favicons()`, `p.html.minify()`, `p.images()`, `p.node.polyfills()`, `global.d.ts`, the shim exports and the `vite` bin are unchanged.

## 4. Order of work

1. V-8 bumps and the `~/` import conversion (mechanical).
2. V-1 (`paths` removal) and V-7 — together, one minor release, with the ui docs config cleanup.
3. V-2 (external sprite) with a ui release that verifies the `icon` component against both href forms.
4. V-3, V-4, V-5, V-6 — independent, each a small PR; measure the ui docs build after V-5.

## 5. Implementation notes (2026-11-03, branch `upgrade/stack-2026-11`, 17 commits, not pushed)

Implemented: V-1 … V-8. Gate: `verify` green, 102 tests, end-to-end sprite/dev/sass checks under `.tmp`. A README was created (none existed).

Decisions and deviations:

- V-2: placeholder is a string literal so it survives minification; URL patch uses `magic-string` (new dependency); sprite is emitted under an explicit `<assetsDir>/sprite.<8-hex content hash>.svg` so `assetFileNames` cannot drop the name; preload link added.
- V-3: `@minify-html/node` is CommonJS; imported as a default (a real-config build caught this, unit tests had not).
- V-4: the old favicons plugin never wrote the icon files; they are now cached and emitted. Image cache moved to `node_modules/.cache/@esportsplus/vite/images`.
- V-5: Vite resolves `sass-embedded` by name from the app root or next to the app's own `vite`; a linked or isolated install of this package is not reachable. `sass-embedded` is a required peerDependency; a `pre` transform on `.scss/.sass` fails fast with `@esportsplus/vite: sass-embedded is not resolvable from <root>; add it to devDependencies`. Apps that depend only on this package and run its `vite` bin need nothing extra.
- V-7: `config(base)` returns `(env) => UserConfig`; wrapping it in `defineConfig((env) => …)` no longer works; `mode` from `base` still wins. Worker chunks follow `assets/[hash].js` via `worker.rolldownOptions.output`.
- Dev server defaults (`host: true`, `open: true`) unchanged and now documented.

Consumer actions applied in `G:/ui-upgrade`: `export default config({...})` in docs (alias workaround deleted), icon component no longer prefixes `#`, announcement example `href='${close}'`, `sass-embedded` added as a devDependency while `link:` is used.
