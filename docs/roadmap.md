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

### 🟡 Phase 5 — UI/UX overhaul

Site-wide review of the UI/UX, decided by the owner on 2026-10-08 (includes the fixed `.h150px` heights). Inventory done on 2026-10-08: [UI/UX audit](ui-design.md#uiux-audit-2026-10-08) (U-01 … U-53). 

Scope decided by the owner on 2026-10-08:
- **Fully responsive on every screen type** (phone portrait/landscape, tablet, desktop).
- **Keep the current visual style** (pixel border, VT323 font, dungeon tiles), cleaned up.
- **Isometric view kept**, improved where needed.

Delivered in three batches, each checked in a browser by the owner:
- 🟡 **Batch A — quick fixes**: U-03 colour variables, U-04 focus / accessible close button / image `alt`, U-05 spelling, U-06 inline styles, U-52 duplicated banner CSS. Done on 2026-10-08; awaiting the owner's browser check.
- ⬜ **Batch B — playability**: U-34 visible fight cells, U-35 active player on the board, U-36 weapon spin, U-37 confirm before leaving, U-41/U-42 complete rules and closing, U-51 health in the fight banner, U-53 end-of-game choice.
- ⬜ **Batch C — responsive layout**: U-01, U-02, U-07?, U-10, U-20, U-21, U-30, U-31, U-32, U-33, U-40, U-50 (closes the last Phase 3 item). Keyboard play on the board (rest of U-04) to be decided.

Done when: the three batches are done and the owner has checked every screen on a phone, a tablet and a desktop without scroll or overflow.

## Ideas / later

TODO(owner): to be filled.
