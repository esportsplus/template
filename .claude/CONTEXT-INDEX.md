---
generated: 2026-07-20T23:47:44.218Z
source-hash: 63bcf0a50d9c50ef
kind: context-index
---

# Context Index — @esportsplus/template

@esportsplus/template@0.17.8
Entry points: ./build/index.js, ./build/index.d.ts
Glossary: see `.claude/CONTEXT.md`

## Commands

- build: `tsc`
- test: `vitest run`
- test:coverage: `vitest run --coverage`
- test:watch: `vitest`

## Top Modules

- src/constants.ts (rank #1) — Runtime constants — attribute delimiters, lifecycle ev…
- src/slot/index.ts (rank #2) — Barrel exposing the default slot factory and render fo…
- src/types.ts (rank #3) — Shared TypeScript types for templates, slots, attribut…
- src/compiler/constants.ts (rank #4) — Compile-time constants — entrypoint names, namespace, …
- src/utilities.ts (rank #5) — DOM helpers — clone, fragment, marker, cached template…
- src/slot/cleanup.ts (rank #6) — Disconnect-lifecycle wiring and node removal for slots
- src/slot/array.ts (rank #7) — ArraySlot — reactive array rendering with moveBefore-b…
- src/slot/effect.ts (rank #8) — EffectSlot — reactive/async effect rendering with load…
- src/slot/render.ts (rank #9) — Renders a value (node, array, primitive) into a slot p…
- src/event/index.ts (rank #10) — Event delegation and lifecycle-event routing (runtime …

## Risk

Tiers: HIGH 6 · MEDIUM 70 · LOW 14

Top risk symbols:
- NAMESPACE (src/compiler/constants.ts, HIGH 0.70)
- PACKAGE_NAME (src/compiler/constants.ts, HIGH 0.68)
- default (src/compiler/index.ts, HIGH 0.67)
- ENTRYPOINT (src/compiler/constants.ts, HIGH 0.66)
- ENTRYPOINT_REACTIVITY (src/compiler/constants.ts, HIGH 0.66)

## Full snapshot

See `.claude/CONTEXT.md` for the full module map, dependency graph, metrics, and risk table. Refresh: `node ~/.claude/core/snapshot.ts <project-root>`.

