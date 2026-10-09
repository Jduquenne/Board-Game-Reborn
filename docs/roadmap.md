# Roadmap

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⏸ waiting for a decision · ❌ rejected

## Current focus

**Current (2026-10-09):** game design, [`spec-game-design.md`](spec-game-design.md) v0.3 — batches 1 (stats + Strength), 2 (criticals + dodge), 3 (flee, with the player choosing the escape cell), 4 (weapon types), 5 (classes, auto-tuned health) and 6 (derived initiative, sudden death) are done — re-tuned health after batch 6 waiting for the owner. **Next: batch 7** (retrain the AIs: fight models saved before batch 3 must be retrained), 8 (Intelligence, mana, spells).

Still open on the side: Phase 7.4c (reinforcement on top of imitation) and 7.5 (generic recipe); offline font (Ideas / later).

Owner priorities set on 2026-10-08:

1. ✅ Phase 6 — automated UI checks.
2. 🟡 Phase 7 — trainable AI (owner's main goal: learn how to train a game AI).
3. 🟡 Game design (stats, combat, classes) — current work.
4. Phase 8 — game feel and content.

## Honest status (2026-10-08)

Based on reading the code, plus the owner's in-browser checks of the Phase 3 fixes.

- Menu, options (board size, item counts, game mode) and game screens exist and are routed.
- Full game loop implemented: board generation, movement, weapons, bonuses, traps, fights, victory.
- AI opponent with `easy` and `normal` modes.
- All JS files pass the ES module syntax check (`docs/development.md` § Syntax check).
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

- ✅ **7.1 Environment** (2026-10-08): pure rules (`Rules.js`), simulator `GameEnv` (reset / step, no delays), agents interface (`ScriptedAgents.js`: random, easy, normal), seeded `Arena` + `training/arena.mjs` (~5,700 games/s). Done when: the game behaves as before (all engine tests pass), agents can play full games in the simulator, results are reproducible with a seed. Checked by the owner.
- ✅ **7.2 Training page + first learning (fights)** (2026-10-08): page `#training` with speed control (Regarder → Max in a Web Worker), learning curve, strategy map, live board; tabular Q-learning of attack / defend ([D-012](decisions.md#d-012--first-learning-tabular-q-learning-of-fight-decisions-training-page-in-a-web-worker)); "IA Entraînée" mode. Done when: the page shows the AI learning, the trained fight policy reaches at least the level of the "normal" fight rule, and the "IA Entraînée" mode uses it. Result: ~12 % → 51.5 % (= Normal's rule, not above: fights are mostly decided before they start). Checked by the owner.
- ✅ **7.3 Movement** (2026-10-08): score function of reachable cells (9 visible-information features) whose weights are evolved by a genetic algorithm ([D-013](decisions.md#d-013--movement-learned-by-a-genetic-algorithm-on-a-weighted-score-of-cells)); lesson "Déplacement" on the training page (weights bars, champion demos); "IA Entraînée" uses the evolved movement. Done when: the evolved agent beats Normal clearly (> 60 %) on games it never trained on, the page shows the evolution, and the game mode uses it. Result: 65.6–71.8 % against Normal; 95 % / 92 % against random / easy. Checked by the owner.
- 🟡 **7.4 Neural network** (owner agreement 2026-10-08), in three sub-steps ([D-014](decisions.md#d-014--hand-written-neural-network-movement-first-learned-by-imitating-the-champion)):
  - ✅ **7.4a Network** (2026-10-08): hand-written multilayer perceptron, backpropagation, SGD / Adam. Done when: numerical gradient check and XOR pass.
  - 🟡 **7.4b Imitation** (2026-10-08): the network learns to imitate the genetic champion from raw inputs (distillation); lesson "Réseau de neurones" with loss curves; usable by "IA Entraînée". Done when: the network beats Normal from raw inputs and the page shows training vs test error. Result: 54–57 % against Normal (teacher 70.5 %). Awaiting the owner's check.
  - ⬜ **7.4c Reinforcement**: improve the imitating network by playing (REINFORCE). Done when: TODO — defined at the start of the step.
- ⬜ **7.5 Generic recipe**: learning notes summarised as a step-by-step recipe to apply to other games. Done when: TODO.

✅ Bug found during 7.1, fixed on 2026-10-08 (owner's choice): a player with no reachable cell now automatically skips their turn (`turn:skipped`), in the game and in the simulator.

### ⬜ Phase 8 — Game feel and content (proposed)

Owner request on 2026-10-08: more "realism" and content. Candidates, scope to validate: movement animation (and other animations), new bonuses, different weapons, character creation. Done when: TODO(owner).

### ⏸ Character balance (found 2026-10-08)

Measured with `training/balance.mjs` (see devlog 2026-10-08): health dominates when AIs engage (Xena 87 %, Indiana 22 %), movement points dominate when they are cautious (58 % draws), and the first player has a 57–63 % advantage. Waiting for the owner's decisions on what to change.

Owner's wishes (2026-10-08):
- 🟡 A visual **balance lab** in the AI training area (2026-10-08, [D-015](decisions.md#d-015--balance-lab-stats-edited-in-the-lab-only)): page `#balance`, editable health / movement points (lab only), win-rate bars, duel matrix, draws and first-player advantage, "Copier les stats". Awaiting the owner's check.
- 🟡 Richer **game design**: more character stats, weapons suited to some stats, and a **flee action** in fights (owner's idea, 2026-10-08). Draft specification: [`spec-game-design.md`](spec-game-design.md) (v0.3: stats, flee rule, classes and batch order decided by the owner). Batch 1 (stats model + Strength) and batch 2 (Agility criticals, Luck dodge) done 2026-10-08; owner's draft characters applied with tuned health (42.6–58.5 %). Batch 3 (flee) done 2026-10-08, awaiting the owner's check. Next: batch 4 (weapon types).

## Ideas / later

TODO(owner): to be completed.

- ❌ Keyboard play on the board (arrows + Enter) — rest of audit item U-04: rejected by the owner on 2026-10-08.
- ⏸ Offline font: embed VT323 in `assets/` instead of loading it from Google Fonts (U-07); needs licence check ([ATTRIBUTION](../ATTRIBUTION.md)).
