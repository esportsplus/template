# Plan: faster attributes, compiler and runtime, keeping the merge model

Status: consolidated from the attribute plan and the exploration notes. Implemented in 0.58.0 except the
items under Deferred at the end. Steps are in implementation order; each is its own commit unless it says
otherwise.

Goal: make compiled templates, the runtime and the compiler faster and smaller without losing a
feature. Main keeps its class/style record keeping: a per-element `STORE` whose list state
(`static` plus the shared `dynamic` set) merges every writer to one element, written as one
`className`/`cssText` string. Every change must fit that model and is kept only if it measures faster
or removes code at no cost.


## Decisions already made

- The `setClass`/`setStyle`-per-element runtime from worktree `t3code-c7c53f00` is not ported: it
  allowed one writer per list. Three of its ideas survive as steps 2.1, 2.3 and 2.4.
- Not to be reintroduced, all measured as noise: typed text emission (`textContent`, direct text
  nodes, `textEffect`/`TextSlot`, a `slot()` text shortcut, ≈20 ns per node); attribute-vs-property
  decided at compile time (≈0.2 µs per row); delegated events stored as element properties.
- Rejected by design: one effect per template instance (every binding of a row would rerun on any
  change). Svelte's `template_effect` is the same design with memoised expressions; still coarser than
  one effect per binding.
- Dropped by micro-benchmark (`bench/explore/`, two runs, interleaved rounds, A-vs-A noise floor):
  `childNodes[i]` for far siblings (saves ≈1 ns per step, `childNodes[1]` is 2x one `nextSibling`);
  `firstChild` instead of `firstElementChild` below the root (within noise); `classList.toggle` for a
  token change (+52% over the rebuilt `className` write); `effect(fn, apply)` for attribute bindings
  (+21% creation, +22% update over a compare in the binding's own closure).
- Looked at and not recommended: opcode-interpreted templates (ivi, blockdom), `import.meta.env` or
  `process.env.NODE_ENV` inside the runtime (not replaced in every consumer's `node_modules`; export
  conditions are the portable form), `moveBefore` beyond sort/reverse (not Baseline, throws across a
  connected/disconnected boundary), Marko-style dependency grouping (needs a language the compiler
  owns).
- `values[name]` for plain attributes stays on the element. It is shared across writers and that is
  load-bearing: writer A sets `data-theme="dark"`, B sets `"light"`, A reruns with `"dark"`; today A
  writes. A per-writer closure value would skip and leave B's. The closure move applies to list parts
  only (step 2.3).


## Gates

| Gate | Command | Baseline |
|---|---|---|
| build (strict types) | `pnpm build` | 0 errors |
| dev type gate | `npx tsc --noEmit -p tsconfig.json` | 68 diagnostics, all in `test/` |
| tests | `npx vitest run` | 1611 passed |
| runtime bench | `bench/compiled`, paired rounds (step 0.1) | 0.57.0's own numbers |
| compiler bench | `pnpm bench:run` (`bench/compiler/*.bench.ts`) | recorded in 0.2 |
| micro bench | `node bench/explore/run-browser.mjs` | numbers in the step that cites them |
| output equality | compile a fixture set with the previous and the new compiler, diff | byte-identical unless the step says what changes |
| bundle size | production bundle of `bench/compiled`'s app | recorded in 0.1 |

A step that measures slower on its gate is reverted, not tuned in place.


## Phase 0. Tooling and baselines

### 0.1 Runtime bench tooling

Port from worktree `t3code-c7c53f00`, unchanged in behaviour:

- `bench/compiled/` (`app.ts`, `browser.ts`, `harness.ts`, `run-browser.mjs`): a krausest-style table
  plus a card list compiled through the real pipeline with a type checker, run in headless Chrome.
- `bench/krausest/harness.ts`: record script time before the forced layout alongside the total.
  Layout is ~64% of row creation and ~78% of updates and hides JS changes.
- The card "like" op split into a first change and a repeat (the forced GC before each sample makes
  first-change paths read cold).
- `pair.mjs` (rotated paired rounds of N builds) and `profile.mjs` (CPU profile of one scenario,
  optionally one function), both in `C:/Users/ICJR/.t3-web/worktrees/template/_scratch_c7c53f00`
  today. Move into `bench/compiled/` with arguments instead of hard-coded paths.
- Keep `bench/explore/` (micro-benchmarks with noise floor; resolves dependencies from the main
  checkout when the worktree has no `node_modules`).

Commit: `test(bench): add compiled app benchmark, script timing and micro-benchmarks`.
Gates: build, tests, then one 10-round run of 0.57.0 against itself for the noise floor, and the
production bundle size.

### 0.2 Compiler baseline

Add a checked-in corpus of ~30 representative templates from `test/compiler`. Time
`findTemplateArtifacts` + `generateCode` per file with a checker. Count checker calls through the
`cached()` proxy behind an env flag. Record both before any compiler change. Cost order to confirm:
`references.origins()` inside `@esportsplus/typescript`; `specialize()`'s `immutable()` walks; the
`analyze`/`fold`/`isTextual` type queries; everything else.

Commit: `test(compiler): add corpus benchmark and checker-call counter`.


## Phase 1. Correctness

### 1.1 Dynamic `class` on an SVG element throws

`apply()` in `src/attributes.ts` assigns `element.className` for every `class` write before its SVG
check. `SVGElement.className` is a read-only `SVGAnimatedString`; under strict mode the assignment
throws (confirmed in jsdom: "Cannot set property className of #<SVGElement> which has only a
getter"). Any `html\`<svg><circle class="${x}"/></svg>\`` fails today. Branch to
`setAttribute('class', v)` when `element.ownerSVGElement != null` (the same check `attribute()`
uses); `cssText` is fine on SVG. Add a test.

External: works instead of throwing.
Commit: `fix(attributes): write class through setAttribute on SVG elements`.
Gates: tests, build.

### 1.2 Clean style seeds

A style list seeded from `getAttribute('style')` after the browser serialised `cssText` joins as
`width: 10px;; color: red`. Trim a trailing `;` from the seed. Add a test.
Commit: `fix(attributes): trim the trailing semicolon of a style seed`.

### 1.3 Drop the array branch of `reactive()` for plain attributes

A reactive plain attribute accepts an array return and writes the last changed entry. Nothing
documents it; the one test pinning it casts through `unknown`. Delete the branch and the test. Lists
keep arrays.
Commit: `refactor(attributes): drop array returns for plain attributes`.


## Phase 2. Runtime: attributes and creation (`src/attributes.ts`, `src/utilities.ts`, codegen)

Gates for every step: build, dev type gate, tests, paired runtime bench against the previous step.
Watch rows create, the class/style/disabled toggles, cards create, first-change like.

### 2.1 One list call per element, merged at compile time, with compile-time static tokens

Today the compiler emits one `setList` per class (or style) part; each part looks up the store and
every reactive part writes the attribute on its first run, so three class parts write `className`
three times at creation. Emit one call per element and list:

```
setClass(el, ['static tokens', part1, part2, attributes?.class])
setStyle(el, ['static decls', part1, attributes?.style])
```

- One store lookup. Each function part still gets its own effect and its own record, so updates stay
  fine-grained and other writers merge. Creation defers the attribute write while the parts' first
  runs record their tokens, then writes the joined list once.
- Static tokens are the first part, already trimmed and joined with the delimiter by the compiler
  (the parser's `metadata()` has them), and stripped from the clone. The runtime seeds
  `listState.static` by assignment: no `getAttribute`, no `trim`, no `collect()`. Safe because the
  template's call is the first writer at creation. Micro-measured: 199 ns to 12.5 ns per element for
  four tokens (−94%).
- Spreads: an expanded spread literal contributes its `class`/`style` as parts; a spread object the
  checker proves is not an array contributes `attributes?.class`/`attributes?.style`, its other keys
  go through `setProperties` with class and style skipped; anything else stays on `setProperties`.
- Hand-written `setList` and `setProperties` are unchanged and still merge with the compiled call.

External: adds `setClass`/`setStyle` exports; the clone no longer carries static class/style
attributes (nothing paints between clone and the first write).
Commit: `feat(attributes): one merged list call per element with compile-time static tokens`.
Gates: output equality (class/style calls and the clone change), build, tests, paired bench.

### 2.2 Static lists skip list state

A static `setList` value allocates the store, a list state and a `Set` only to append tokens. Until a
reactive binding needs that state, append to the attribute directly; seed the state from the
attribute when first needed. Measured earlier as creates −3.5% to −6.9% (12 paired rounds). Re-measure
after 2.1, since merged static parts may already cover it. Behaviour unchanged, multiple writers
included.
Commit: `perf(attributes): static lists write the attribute without list state`.

### 2.3 Per-part bookkeeping in the effect closure; the shared store stays on the element

`list()` keeps three things in `STORE`:

| Field | Read by | Stays? |
|---|---|---|
| `store[name]` (`{ static, dynamic: Set }`) | every writer of that list | yes, this is the merge |
| `ctx.raw[id]` | only the effect owning `id` | no, closure |
| `ctx.cold[id]` | only the effect owning `id` | no, closure |

Move `raw` and `cold` into a per-part state object the effect closes over. `Context` becomes
`{ store, values }`, `reactive()` loses the `id` counter, `list()` takes the part state instead of
`ctx`/`id`, and `hot` becomes the part's previous token array. `values[name]` stays shared (see
Decisions). Micro-measured: first part on a fresh element 517 ns to 181 ns (−65%).
Commit: `perf(attributes): keep list part state in the binding closure`.

### 2.4 One effect per list until its first change

Builds on 2.1. At creation one effect runs every function part and records each part's tokens under
its own state; on the first change it splits into one effect per part, each reusing its state. From
then on every part reruns on its own. Costs: the first change runs every part once more; the split
code runs cold after a forced GC. Kept only if the creation saving outweighs the first-change cost.
Commit: `perf(attributes): one effect per list until its first change`.

### 2.5 Compile the composed-value join; delete `interpolate()`

`interpolate(parts)` allocates a `callbacks` array, runs `.map` and `.some`, allocates a `join`
closure per instance and does `String(value)` per part per run. The compiler knows which parts are
arrow functions and which are proven text (`isTextual`). Emit
`(el) => 'width: ' + s(fn(el)) + 'px'` with `s(v)` = `v == null || v === false ? '' : v`, skipped for
proven text. Micro-measured: build plus first call 84 ns to 26.5 ns (−68%), each later call 28.8 ns
to 22 ns (−24%).

External: the `interpolate` export (public through `export *`, undocumented) is removed.
Commit: `perf(compiler): emit composed values as concatenation and drop interpolate`.
Gates: output equality changes for composed values only; `codegen.test.ts`, `emission.test.ts`.

### 2.6 Per-declaration style writes

A style change rewrites `cssText` for the whole element. The store already collects style parts as
`name: value` strings, so when a part's change is a value under an unchanged name, write
`style.setProperty(name, value)` (priority split out for `!important`) and skip the join; a string
part not shaped `name: value` keeps `cssText`. The store still records every writer's declarations.
Micro-measured on a mounted element with five declarations: 926 ns to 167 ns (−82%), script cost
without forced layout. Confirm under the paired bench with forced layout (cards like) before keeping.

External: the serialised `style` attribute may order declarations differently from a `cssText`
rewrite.
Commit: `perf(attributes): write a changed style declaration through setProperty`.

### 2.7 Single-root templates clone the element, not a fragment

Solid, Svelte and Vue Vapor all clone the root element directly when a template has one root and keep
the fragment path otherwise. The compiler knows the root count: emit an element factory for
single-root templates and use the root as the element in codegen. Multi-root templates are unchanged,
so nothing about how templates are written changes. `ArraySlot.template` gets `head === tail` with no
per-row fragment. Micro-measured on the krausest row: 1910 ns to 1525 ns per instance (−20%).

External: a single-root template evaluates to the `Element`. The return of `html` widens to
`DocumentFragment | Element | Text`, as do the row callback types of `html.reactive`/`html.virtual`.
Code that reaches into a result (`.firstChild` to take the row) breaks; content passed to `render()`
and slots keeps working. `G:/ui/src` has no such reach-ins (checked).
Commit: `perf(runtime): clone the root element of single-root templates`.
Gates: output equality (expected change, documented), tests, paired bench on rows and cards create.

### 2.8 `createTextNode` instead of clone and set

`text()` clones an empty text node then writes `nodeValue`; one `document.createTextNode(value)` call
micro-measures 191 ns to 161 ns (−16%).
Commit: `perf(runtime): create text nodes with createTextNode`.


## Phase 3. Development-only healing (`src/slot/cleanup.ts`)

### 3.1 Keep the `isConnected` guards; the sweep runs in development only

The guards stay in attribute effects and `EffectSlot` (≈41 ns per read; removing them saved 1–10% of
update script time within wide noise, not worth losing detection at rerun time).

The idle sweep polls `isConnected` on every tracked top-level slot about once a second. It is the only
cleanup for: top-level slots removed by code outside the library whose effects never rerun; orphaned
cleanups on content never adopted; `ondisconnect` on elements with no owner. None arise under
`render()` or another owner.

- Move the polling (`schedule`, `tick`, `sweep`, `settle`, `compact`, the `tracked` list) behind a
  `DEV` flag. In production `track()` returns at once and `orphan()` only records cleanups on the node
  so `adopt()` can still claim them.
- The flag comes from export conditions, which Vite resolves by default (`resolve.conditions` is
  `['module', 'browser', 'development|production']`, following `NODE_ENV`); Lit ships its development
  build this way and Svelte reads `DEV` from `esm-env`, which is only a package whose `exports` map
  `development` to `export const DEV = true`. Add `"./env": { "development": "./build/env.development.js",
  "default": "./build/env.js" }` to `exports`; `cleanup.ts` imports `DEV` through the package
  self-reference. Rollup, webpack, esbuild and Vite drop the dead branch; Vitest resolves with
  `NODE_ENV=test`, so tests get the development branch with no configuration; the tsc plugin needs
  nothing.
- The sweep becomes a leak detector: it warns with the package prefix and the element, then still
  releases, so the development session stays clean.
- Document the rule: content lives under `render()` or another owner, or whoever built it disposes
  it. `ondisconnect` on an element with no owner fires only in development.
- Tests: `test/slot/heal.test.ts` runs with the development module; add one production-mode test
  proving nothing is scheduled.

External: healing after foreign removal and `ondisconnect` on ownerless content are
development-only; a new `./env` subpath; tooling without export conditions gets production.
Commit: `feat(cleanup): run the foreign-removal sweep in development only`.
Gates: build, tests, paired bench level (idle time is outside every timed region), bundle size.


## Phase 4. Reactivity integration (`@esportsplus/reactivity` 0.39.2)

Items 4.1 and 4.2 need a reactivity release (or a local link of the reactivity repo next to this
one); 4.3 and 4.4 follow them. The DOM-aware guards (`isConnected`, `stale`, `heal`, `revival`), the
frame ticker, event delegation and the development sweep stay template-side: reactivity has no notion
of a node being in the document.

### 4.1 Expose the owner; drop the template's parallel owner tree

`slot/cleanup.ts` keeps `current`, `enter()`, `exit()`, `context()` and `Slot.parent` only so
`climb()` can find the outermost slot foreign code removed. Reactivity keeps the same tree
(`Computed.owner`, O(1) `own`/`disown`, ordered cleanup). `Computed.owner` is already a public field,
but the template never holds a node to read it from: the running owner is `observer || scope`,
module-private in `system.ts`; `effect()` returns only a disposer, `root()` passes only a disposer,
and `hasOwner()` returns a boolean. Add to reactivity `owner()`, returning `observer || scope` (the
node whose `.owner` chain the template walks), and an optional second argument to `root(fn, owner?)`.
The argument sets `scope`, never `observer`: ownership only, reads stay untracked, as `untrack` does.
`root(() => …, owner)` runs `fn` owned by `owner` (re-entering it after an `await`);
`root(dispose => …, owner)` creates a child root owned by `owner` instead of whatever is running (an
array row, an async slot's content). A disposed node must not be passed: `own()` would park children
on it that nothing disposes, so the template checks its slot's `disposed` first and reactivity throws
on a node `dispose()` has already nulled. The template maps owner to
slot through a `WeakMap`; `Slot.parent` becomes the nearest ancestor owner with a slot; `enter`/`exit`/
`context` are deleted from `render.ts`, `hmr.ts`, `slot/array.ts`, `slot/effect.ts`, `virtual/slot.ts`
and `event/index.ts`. `runWithOwner` also gives content built after an `await` a real owner, so
`claim()` only covers genuinely top-level calls.

External (template): the public `parent` field on `ArraySlot`/`EffectSlot`/`VirtualSlot` goes.
Commits: `feat(reactivity): expose owner() and runWithOwner()`; `refactor(cleanup): use reactivity's
owner tree`.
Gates: tests in both packages, `test/slot/heal.test.ts`.

### 4.2 Batched array events; drop the per-slot queues

`ArraySlot` subscribes ten listeners, keeps its own `queue`, `scheduled` and `queueMicrotask`, and
exposes `flush()`; `VirtualSlot` carries a second copy. Add to `ReactiveArray` one coalesced `batch`
event per task (a `clear` discards earlier operations in the batch), applied inside the reactivity
pass so reactivity's `flush()` settles it. A slot becomes one subscription with no queue; about 70
lines leave `slot/array.ts` and a similar amount `virtual/slot.ts`. `ArraySlot.length` reads
`array.$length`.

External: `ArraySlot.flush()` and `VirtualSlot.flush()` are removed (documented in the README; see
7.3 for the UI's nine call sites); `length` differs from the rendered length only between a mutation
and its microtask.
Commits: `feat(reactivity): dispatch one batch event per task on ReactiveArray`; `refactor(slot): apply
array batches through reactivity`.

### 4.3 Adopted cleanups through `onCleanup`

`EffectSlot.content` is a cleanup list parallel to the effect's own. Inside the run an owner is
present, so `adopt(fragment)` can hand the claimed cleanups to `onCleanup`, and reactivity's
`cleanup()` runs them in registration order before the next run. Ordering difference: today the
replaced content's cleanups run after the new content is inserted; under `onCleanup` they run before
it is built. Decide first whether any `ondisconnect` depends on seeing the new content; if none,
drop `content`, `claim()` in `effect.ts` and the manual `run(content)` calls.
Commit: `refactor(slot): register adopted cleanups with onCleanup`.

### 4.4 Async slots as async computeds

`EffectSlot` calls an async function once and chains `.then`; it never re-runs. `computed(fn)` already
turns a Promise or AsyncIterable return into a settled computed with latest-wins, a `pending` signal
and `computed.invalidate()`. Build the async branch as `c = computed(fn)` plus
`effect(() => update(read(c.pending) ? fallback : read(c)))`. Gains: reactive re-fetching, stale
results dropped, streaming from `async function*`, errors surfacing through `read()` instead of the
empty rejection handler. Keep the `fallback(x)` callback by mapping it to the content shown while
`pending`.

External: an async slot re-runs when a signal it read before its first `await` changes; a rejection
surfaces as an error. This is the largest behavioural change in the plan.
Commit: `feat(slot): async effect slots are async computeds`.
Gates: new tests in `test/slot/effect.test.ts`; README async section rewritten.


## Phase 5. Compiler

Gates for every step: output equality on the corpus, the compiler bench, the checker-call count,
tests. Ordered by expected payoff; measure each alone.

### 5.1 Simplifications (no output change)

- Hoist the mask regex in the parser: `outsideAttributeValues()` builds `new RegExp(marker…)` per call
  and runs twice per template. One fixed marker, one module-level regex.
- Fast paths before checker queries: `isTextual()` and `analyze()` need no query for a string,
  number or no-substitution template literal.

Commit: `perf(compiler): hoist the mask regex and skip checker queries for literals`.

### 5.2 Caches and skips

1. A parse cache across transforms: `parser.parse()` is pure in its literals, but `parseCache` lives
   for one transform, so the dev server re-parses every template of a file on each HMR transform.
   Module-level `Map` keyed on the joined literals, bounded (2,000 entries, cleared on overflow).
2. Cache per program: `references.exported(...)` runs per file and `cached(checker)` is rebuilt per
   transform; within one build every file shares a program. Key both on the program in a `WeakMap`,
   dropped when the program instance changes.
3. Skip origin resolution for files that cannot hold a site: a file with no import declarations, no
   `require()` and no `import()` has no `html` to reach (`sourceFile.imports`), so
   `references.origins()` is skipped and `escapes` is empty by construction.
4. Early exit in `specialize()` when no expression contains an identifier.
5. Range checks in `generateCode`: `ast.inRange` scans linearly; sorted ranges with binary search, only
   if the corpus has files with hundreds of templates.
6. `references.origins()`: if 0.2 shows it dominates, the fix belongs in `@esportsplus/typescript`
   (resolve only identifiers that can denote an import or a const alias). Record as a follow-up.

Commit per item: `perf(compiler): …`.

### 5.3 More compile-time work

- Fold slotless nested templates into the parent's markup: `${html\`<b>x</b>\`}` in an unconditional
  node position, or an array of such, inlines as markup, removing a factory, a clone and a `slot()`.
- Hoist inline handlers that close over nothing local to module scope (checker: every identifier
  resolves to a module-level or imported binding). One closure per module instead of one per
  instance; no runtime cost.
- Pin with a test that specialisation variants sharing identical markup after folding share one
  hoisted `template()` call.

Commits: `perf(compiler): fold static nested templates`; `perf(compiler): hoist local-free handlers`.

Not planned: parallel transforms or caches across processes.


## Phase 6. Release

- Version 0.58.0: 2.1 adds exports; 2.5 removes one; 2.7, 3.1, 4.2 and 4.4 change behaviour or
  emitted code.
- README: async slots (4.4), ownership and cleanup (3.1, 4.1), the removal of `slot.flush()` (4.2),
  the `Element` return of single-root templates (2.7), the development build and export conditions.
- Build `build/` locally; phase 7 links against it.


## Phase 7. Integrate with `G:/ui`

The UI (`@esportsplus/ui` 0.60.0, root plus the `docs` workspace package) depends on
`@esportsplus/template ^0.56.0` and uses the Vite plugin from `@esportsplus/template/compiler/vite`
in `docs/vite.config.ts`. It must compile, build and run against the local repo with every phase
above applied. Outputs differ from `G:/ui` main where the API changed; rendering must not.

### 7.1 Worktree and link

- `git -C G:/ui worktree add C:/Users/ICJR/.t3-web/worktrees/ui/template-0.58 -b feat/template-0.58`.
- Point both `package.json` files (root and `docs/`) at the local repo:
  `"@esportsplus/template": "link:G:/template"` (and `@esportsplus/reactivity` the same way if phase 4
  landed through a local link rather than a release). `pnpm install` in the worktree. The template
  package's `prepare` runs its build, so `G:/template/build` must be current.
- Never use bare `git stash` in either worktree; the stash stack is shared.

### 7.2 Compile and build

- `pnpm build` in the UI worktree (`vite build` then `tsc`): 0 errors.
- `pnpm --dir docs typecheck`: 0 errors.
- Every type error is one of the external changes above; fix at the call site, not with casts.

### 7.3 Adapt to the API changes

Found by searching `G:/ui/src`; expand the search in the worktree once the build reports.

- `slot.flush()` (4.2), nine call sites: `components/typewriter/rotate.ts` (two), `input/tag.ts`,
  `surface-field/index.ts`, `tooltip/shared.ts`, `inline-edit/rich.ts` (two), `sortable/index.ts`
  (two, one of them re-exported as `flush`), `editor/tree/template.ts`, `tasklist/index.ts` (two).
  Replace with `flush()` from `@esportsplus/reactivity`. The `ime.flush()` calls in the editors are
  not slot calls; leave them.
- `slot.length` in `input/tag.ts` (`aria-label` binding): still reactive; no change expected.
- Single-root `Element` results (2.7): no `.firstChild` reach-ins found in `src`; check `docs/src`.
- Async slots (4.4): search for `async (` inside templates and confirm each is happy to re-run and to
  surface rejections.
- SVG dynamic classes (1.1): now work; nothing to change.
- Style attribute order (2.6) and `ondisconnect` ordering (4.3): search tests and components that
  compare `cssText` or inspect siblings in `ondisconnect`.

Commit in the UI worktree: `chore(deps): use local @esportsplus/template 0.58 and adapt slot flush`.

### 7.4 Run

- `pnpm --dir docs dev` serves the docs with the template Vite plugin in development mode: the
  development sweep (3.1) loads through the `development` condition and HMR works on a saved template
  file.
- Load the docs in headless Chrome (the `--headless=new --dump-dom` pattern from
  `bench/explore/run-browser.mjs` against the dev server URL) and check: no console errors, no
  `@esportsplus/template:` warnings from the leak detector on initial render, and the dumped DOM for
  the component pages contains the expected rendered components. Then do the same against a
  production build of the docs (`vite build` in `docs/`, served statically) to prove the production
  bundle excludes the sweep and renders the same pages.
- Exercise one component per external change in the browser: a list that was flushed (4.2), a
  component using an async slot (4.4), an SVG icon with a dynamic class (1.1), a component that
  animates a style declaration (2.6).

Done when both builds are clean, both page dumps match the expected components, and the UI worktree's
commit is pushed to its branch for review.


## Order

| Step | Depends on | Gates |
|---|---|---|
| 0.1, 0.2 tooling and baselines | — | build, tests, noise floor, bundle size |
| 1.1, 1.2, 1.3 correctness | — | tests, build |
| 2.1 merged list call with compile-time statics | 0.1 | output equality, build, tests, paired bench |
| 2.2, 2.3, 2.4 list state and effects | 2.1 | build, types, tests, paired bench each |
| 2.5 compiled join | — | output equality, tests |
| 2.6 per-declaration style writes | 2.1 | paired bench with forced layout |
| 2.7 single-root clone, 2.8 `createTextNode` | 0.1 | output equality, tests, paired bench |
| 3.1 development-only sweep | — | build, tests, bench level, bundle size |
| 4.1, 4.2 reactivity additions | reactivity release or link | tests in both packages |
| 4.3, 4.4 cleanups and async slots | 4.1 | tests, README |
| 5.1, 5.2, 5.3 compiler | 0.2 | output equality, compiler bench, checker calls |
| 6 release | all above | README, version |
| 7 `G:/ui` worktree | 6 | UI build, docs typecheck, dev and production page dumps |

Phases 2, 3 and 5 are independent of each other; 4 depends on the reactivity changes; 7 is last.


## Deferred

Not implemented in 0.58.0:

- 2.4 one effect per list until its first change: reverted; it needs the paired bench to show the creation saving
  outweighs the extra first-change run before it is worth keeping.
- 4.3 adopted cleanups through `onCleanup`: it moves replaced content's cleanups before the new content is built, which
  changes `ondisconnect` ordering and needs a decision first.
- 5.3 fold slotless nested templates into the parent's markup: an optional compile-time fold, no correctness or API
  change depends on it.
