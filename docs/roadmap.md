# Roadmap

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⏸ waiting for a decision

## Current focus

TODO(owner): to be filled after the migration.

## Honest status (2026-10-08)

Based on reading the code; no in-browser play-through was done during the migration.

- Menu, options (board size, item counts, game mode) and game screens exist and are routed.
- Full game loop implemented: board generation, movement, weapons, bonuses, traps, fights, victory.
- AI opponent with `easy` and `normal` modes for movement.
- All 26 JS files pass `node --check`.
- No automated tests, no lint.
- Known deviations: see [ui-design](ui-design.md#known-deviations) and the TODO in [spec-gameplay](spec-gameplay.md#ai).

## Phases

All phases below are **proposed** (derived from git history and code during the migration); the owner will adjust them.

### ✅ Phase 1 — Architectural rewrite (proposed)

Done when: the original BoardGame gameplay runs on the layered vanilla JS architecture ([D-003](decisions.md#d-003--layered-architecture)) with zero dependencies. Commit `eddd594` (2026-03-09).

### ✅ Phase 2 — AI opponent (proposed)

Done when: `easy` and `normal` modes can be selected in options and the AI plays its moves. Commit `ca9e75f` (2026-04-12).

### ⏸ Phase 3 — Align UI with the no-scroll rules (proposed)

Done when: the deviations listed in [ui-design](ui-design.md#known-deviations) are fixed or accepted, verified in a browser at small and large viewport sizes.

### ⏸ Phase 4 — Automated checks (proposed)

Done when: a zero-dependency way to test `Engine/` logic is decided ([decisions](decisions.md)) and runs as part of the end-of-task checklist.

## Ideas / later

TODO(owner): to be filled.
