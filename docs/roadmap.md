# Roadmap

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⏸ waiting for a decision · ❌ rejected

## Current focus

Owner priorities set on 2026-10-08, in the order below (order proposed by the agent, to be confirmed):

1. ✅ Phase 6 — automated UI checks.
2. 🟡 Phase 7 — trainable AI (owner's main goal: learn how to train a game AI).
3. Phase 8 — game feel and content.

## Honest status (2026-10-08)

Based on reading the code, plus the owner's in-browser checks of the Phase 3 fixes.

- Menu, options (board size, item counts, game mode) and game screens exist and are routed.
- Full game loop implemented: board generation, movement, weapons, bonuses, traps, fights, victory.
- AI opponent with `easy` and `normal` modes.
- All 26 JS files pass `node --check`.
- 44 automated tests on `src/Engine/` (Node built-in runner), all passing; no tests for Views; no lint.
- AI plays both movement and fight actions.
- "Nouvelle partie" keeps the previous game's settings.
- Responsive layout on phone, tablet and desktop (Phase 5, validated by the owner); remaining UI points in [ui-design](ui-design.md#known-deviations).
- Image sources and licences unknown ([ATTRIBUTION](../ATTRIBUTION.md)).

## Phases

All phases below are **proposed** (derived from git history and code during the migration); the owner will adjust them.

### ✅ Phase 1 — Architectural rewrite (proposed)

Done when: the original BoardGame gameplay runs on the layered vanilla JS architecture ([D-003](decisions.md#d-003--layered-architecture)) with zero dependencies. Commit `eddd594` (2026-03-09).

### ✅ Phase 2 — AI opponent (proposed)

Done when: `easy` and `normal` modes can be selected in options and the AI plays its moves. Commit `ca9e75f` (2026-04-12).

### ✅ Phase 3 — Fix known bugs

Confirmed by the owner on 2026-10-08.

- ✅ The AI plays its own fight actions (Attack / Defend). Done when: in an AI game, a fight runs to the end without the human clicking for the AI. Checked by a Node simulation and in the browser by the owner on 2026-10-08.
- ✅ "Nouvelle partie" keeps the previous game's settings (it used to reload the page and reset them). Done when: after a game played with custom options, "Nouvelle partie" starts with the same options. Checked by a Node simulation and in the browser by the owner on 2026-10-08.
- ✅ No internal scroll in `#menu` (game sidebar) and `.modalRules`. Done when: both use `overflow: hidden` and their content fits, verified in a browser at small and large viewport sizes. Fixed by Phase 5 Batch C; checked with headless Chrome on 8 sizes and by the owner on 2026-10-08.

### ✅ Phase 4 — Automated tests

Decided by the owner on 2026-10-08. Approach recorded in [D-008](decisions.md#d-008--tests-with-nodes-built-in-test-runner); 44 tests cover `MovementSystem`, `GameEngine`, `FightEngine` and `AIEngine` (2026-10-08). The test command is part of the end-of-task checklist in `AGENTS.md`. Done when: a zero-dependency test approach is recorded in [decisions](decisions.md), `Engine/` logic (movement, pickups, traps, fights, AI choices) is covered, and the test command is part of the end-of-task checklist in `AGENTS.md`.

### ✅ Phase 5 — UI/UX overhaul

Site-wide review of the UI/UX, decided by the owner on 2026-10-08 (includes the fixed `.h150px` heights). Inventory done on 2026-10-08: [UI/UX audit](ui-design.md#uiux-audit-2026-10-08) (U-01 … U-53). 

Scope decided by the owner on 2026-10-08:
- **Fully responsive on every screen type** (phone portrait/landscape, tablet, desktop).
- **Keep the current visual style** (pixel border, VT323 font, dungeon tiles), cleaned up.
- **Isometric view kept**, improved where needed.

Delivered in three batches, each checked in a browser by the owner:
- ✅ **Batch A — quick fixes**: U-03 colour variables, U-04 focus / accessible close button / image `alt`, U-05 spelling, U-06 inline styles, U-52 duplicated banner CSS. Done on 2026-10-08; owner moved on to Batch B.
- ✅ **Batch B — playability**: U-34 visible fight cells, U-35 active player on the board, U-36 weapon spin, U-37 confirm before leaving, U-41/U-42 complete rules and closing, U-51 health in the fight banner, U-53 end-of-game choice. Done on 2026-10-08; owner moved on to Batch C.
- ✅ **Batch C — responsive layout**: U-01, U-02, U-10, U-20, U-21, U-30, U-31, U-32, U-33, U-40, U-50 (closes the last Phase 3 item). Done on 2026-10-08, checked with headless Chrome on 8 screen sizes × 9 screens (72/72 without scroll or overflow); validated by the owner on 2026-10-08. U-07 (offline font) and keyboard play (rest of U-04) moved to "Ideas / later".

Done when: the three batches are done and the owner has checked every screen on a phone, a tablet and a desktop without scroll or overflow.

### ✅ Phase 6 — Automated UI checks

Owner agreement on 2026-10-08. Bring the headless-Chrome check used for Phase 5 (8 screen sizes × every screen: no page scroll, nothing outside the viewport, no scrollable or clipped area, screenshots) into the repository as a zero-dependency dev tool. Done when: the tool is in the repo, documented in `docs/development.md`, recorded as a decision, and part of the end-of-task checklist for UI changes. Done on 2026-10-08: `tools/ui-check.mjs` ([D-009](decisions.md#d-009--automated-ui-checks-with-headless-chrome)), 72/72.

### 🟡 Phase 7 — Trainable AI

Owner request on 2026-10-08: train the game's AI and learn how to do it for other games (beginner). Everything hand-written, no library ([D-010](decisions.md#d-010--pure-game-rules-simulator-and-agents-for-ai-training)). Personal learning notes in French in `docs/learning/` ([D-011](decisions.md#d-011--personal-learning-notes-in-french-git-ignored)). A new "IA Entraînée" game mode will use the trained model. The hand-written "Difficile" mode is dropped (replaced by the trained AI).

- ✅ **7.1 Environment** (2026-10-08): pure rules (`Rules.js`), simulator `GameEnv` (reset / step, no delays), agents interface (`ScriptedAgents.js`: random, easy, normal), seeded `Arena` + `training/arena.mjs` (~5,700 games/s). Done when: the game behaves as before (all engine tests pass), agents can play full games in the simulator, results are reproducible with a seed. Awaiting the owner's check that the game still plays normally in the browser.
- ⬜ **7.2 Training page + first learning (fights)**: browser page with live learning curves and a speed control (from watching a game at normal speed to "max" in a Web Worker); tabular Q-learning for the attack / defend decision. Done when: the trained fight policy beats the "normal" fight rule in the arena, the page shows the curve, and the "IA Entraînée" mode uses it.
- ⬜ **7.3 Movement**: score function for cells whose weights are tuned by a genetic algorithm. Done when: TODO — defined at the start of the step.
- ⬜ **7.4 Neural network**: hand-written network + deep reinforcement learning on the whole game. Done when: TODO — defined at the start of the step.
- ⬜ **7.5 Generic recipe**: learning notes summarised as a step-by-step recipe to apply to other games. Done when: TODO.

Known bug found during 7.1 (not fixed, in the game only): a player with no reachable cell cannot pass, so the game is stuck (rare: player surrounded by obstacles, the board edge and the other player). The simulator handles it with a `pass` action. ⏸ Fix in the game (automatic pass?) to be decided by the owner.

### ⬜ Phase 8 — Game feel and content (proposed)

Owner request on 2026-10-08: more "realism" and content. Candidates, scope to validate: movement animation (and other animations), new bonuses, different weapons, character creation. Done when: TODO(owner).

## Ideas / later

TODO(owner): to be completed.

- ❌ Keyboard play on the board (arrows + Enter) — rest of audit item U-04: rejected by the owner on 2026-10-08.
- ⏸ Offline font: embed VT323 in `assets/` instead of loading it from Google Fonts (U-07); needs licence check ([ATTRIBUTION](../ATTRIBUTION.md)).
