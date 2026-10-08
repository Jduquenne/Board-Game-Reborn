# Roadmap

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⏸ waiting for a decision

## Current focus

TODO(owner): to be filled when the time comes.

## Honest status (2026-10-08)

Based on reading the code, plus the owner's in-browser checks of the Phase 3 fixes.

- Menu, options (board size, item counts, game mode) and game screens exist and are routed.
- Full game loop implemented: board generation, movement, weapons, bonuses, traps, fights, victory.
- AI opponent with `easy` and `normal` modes.
- All 26 JS files pass `node --check`.
- 44 automated tests on `src/Engine/` (Node built-in runner), all passing; no tests for Views; no lint.
- AI plays both movement and fight actions.
- "Nouvelle partie" keeps the previous game's settings.
- Known bugs: internal scroll in the game sidebar and rules modal ([ui-design](ui-design.md#known-deviations)).
- Image sources and licences unknown ([ATTRIBUTION](../ATTRIBUTION.md)).

## Phases

All phases below are **proposed** (derived from git history and code during the migration); the owner will adjust them.

### ✅ Phase 1 — Architectural rewrite (proposed)

Done when: the original BoardGame gameplay runs on the layered vanilla JS architecture ([D-003](decisions.md#d-003--layered-architecture)) with zero dependencies. Commit `eddd594` (2026-03-09).

### ✅ Phase 2 — AI opponent (proposed)

Done when: `easy` and `normal` modes can be selected in options and the AI plays its moves. Commit `ca9e75f` (2026-04-12).

### 🟡 Phase 3 — Fix known bugs

Confirmed by the owner on 2026-10-08.

- ✅ The AI plays its own fight actions (Attack / Defend). Done when: in an AI game, a fight runs to the end without the human clicking for the AI. Checked by a Node simulation and in the browser by the owner on 2026-10-08.
- ✅ "Nouvelle partie" keeps the previous game's settings (it used to reload the page and reset them). Done when: after a game played with custom options, "Nouvelle partie" starts with the same options. Checked by a Node simulation and in the browser by the owner on 2026-10-08.
- ⬜ No internal scroll in `#menu` (game sidebar) and `.modalRules`. Done when: both use `overflow: hidden` and their content fits, verified in a browser at small and large viewport sizes.

### ✅ Phase 4 — Automated tests

Decided by the owner on 2026-10-08. Approach recorded in [D-008](decisions.md#d-008--tests-with-nodes-built-in-test-runner); 44 tests cover `MovementSystem`, `GameEngine`, `FightEngine` and `AIEngine` (2026-10-08). The test command is part of the end-of-task checklist in `AGENTS.md`. Done when: a zero-dependency test approach is recorded in [decisions](decisions.md), `Engine/` logic (movement, pickups, traps, fights, AI choices) is covered, and the test command is part of the end-of-task checklist in `AGENTS.md`.

### ⬜ Phase 5 — UI/UX overhaul

Site-wide review of the UI/UX, decided by the owner on 2026-10-08 (includes the fixed `.h150px` heights). Done when: TODO(owner) — scope to be defined.

## Ideas / later

TODO(owner): to be filled.
