---
generated: 2026-07-05T08:11:43.150Z
source-hash: 316b3c0845b2e785
kind: context-index
---

# Context Index — @esportsplus/template

@esportsplus/template@0.17.4
Entry points: ./build/index.js, ./build/index.d.ts

## Commands

- build: `tsc`
- test: `vitest run`
- test:coverage: `vitest run --coverage`
- test:watch: `vitest`

## Top Modules

- src/slot/index.ts (rank #1) — barrel: default slot factory + render
- src/types.ts (rank #2) — shared types for templates/slots/attrs/events
- src/constants.ts (rank #3) — runtime constants (delimiters, lifecycle, state)
- src/compiler/constants.ts (rank #4) — compile-time constants (entrypoints, types)
- src/utilities.ts (rank #5) — DOM helpers: clone, fragment, marker, template
- src/slot/cleanup.ts (rank #6) — disconnect lifecycle + node removal
- src/slot/array.ts (rank #7) — ArraySlot: reactive array w/ moveBefore reorder
- src/slot/render.ts (rank #8) — renders a value into a slot position
- src/slot/effect.ts (rank #9) — EffectSlot: reactive/async effect rendering
- src/compiler/ts-parser.ts (rank #10) — finds html templates + reactive calls

## Risk

Tiers: HIGH 6 · MEDIUM 57 · LOW 17

Top risk symbols:
- NAMESPACE (src/compiler/constants.ts, HIGH 0.69)
- ENTRYPOINT (src/compiler/constants.ts, HIGH 0.65)
- ENTRYPOINT_REACTIVITY (src/compiler/constants.ts, HIGH 0.65)
- TYPES (src/compiler/constants.ts, HIGH 0.65)
- default (src/compiler/index.ts, HIGH 0.65)

## Full snapshot

See `.claude/CONTEXT.md` for the full module map, dependency graph, metrics, and risk table. Refresh via /context-snapshot.

