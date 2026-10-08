# Devlog

Session journal, most recent first. Every session that changes something adds an entry.

Entry format:

```markdown
## YYYY-MM-DD — Short title

- **Done**: what was done.
- **Numbers**: optional (files touched, checks run…).
- **Problems**: what failed or surprised.
- **Still open**: what remains for the next session.
```

## 2026-10-08 — Phase 7.2: training page and Q-learning of fights; automatic turn skip

- **Done**:
  - Owner-approved fix: a player with no reachable cell automatically skips their turn (`turn:skipped`, shown in the trap banner), in the game and the simulator; `AIEngine` never plays for a human.
  - `src/AI/QLearning.js` (generic tabular Q-learning), `FightPolicy.js` (fight observation, trained agent), `FightTrainer.js` (training against an opponent, step-by-step generator, evaluation on fixed games), `TrainingSession.js` + `training.worker.js` (speeds Regarder / Rapide / Turbo / Max).
  - Page `#training` (`TrainingView`, menu "Entraîner l'IA"): controls, 4 stats, learning curve (canvas), strategy map, live board; board HTML shared with the game (`boardTemplate.js`).
  - "IA Entraînée" mode: model saved in `localStorage` (`core/ModelStorage.js`), loaded by `AIEngine`; falls back to Normal.
  - `training/train-fight.mjs` CLI; `tools/ui-check.mjs` covers the training page (3 new screens); `.gitignore`: `training/output/`.
  - Docs: D-012, architecture, spec-gameplay, ui-design, development, conventions (add an AI mode), roadmap; learning notes for 7.2.
- **Numbers**: 78/78 tests (20 new). Training with seed 1: 11.8 % → 51.5 % wins against Normal in ~3,000 games, stable on seeds 1–3 (Normal's own rule: 51.5 % on the same games); 60,000 games in ~7 s (Node); ~17,500 games in under 2 s in headless Chrome at "Max". UI check: 96/96 (8 sizes × 12 screens), exit code 0.
- **Problems**:
  - First version: zero-initialised table showed no learning ("always attack" ≈ Normal) and a coarse observation (hits capped at 5) caused collapses to 11.8 % (endless defending) → random initial values, hits up to 10, α 0.1 → 0.05.
  - A test with fake timers looped forever at turbo speed (0 ms ticks); fixed the test and a real bug (a tick rescheduled itself after a pause).
  - The learned fight policy equals Normal's rule but does not beat it: fights are mostly decided before they start.
- **Still open**:
  - Owner's check of the training page and of the "IA Entraînée" mode in the browser.
  - Phase 7.3 (movement), where the real gains are expected.

## 2026-10-08 — Phase 7.1: environment for AI training

- **Done**: owner's goal recorded (train the game AI, learn how to do it; beginner; French git-ignored notes; training page with speed control). Phase 7 rewritten as 7.1–7.5. Implemented 7.1:
  - `src/Engine/Rules.js`: game rules as pure functions (`createGame`, `applyMove`, `applyPass`, `applyAttack`, `applyDefend`, `resolveRound`, `refreshMarkings`) returning `{ state, events }`; seeded placement (`rng` parameter).
  - `GameEngine` / `FightEngine` reduced to applying the rules to the Store and emitting the events (500 ms round delay kept). `BoardView` also renders in the `fighting` phase.
  - `src/core/Random.js` (`createRng(seed)`, mulberry32).
  - `src/AI/ScriptedAgents.js` (random, easy, normal behind one agent interface), `AIEngine` now plugs an agent into the game.
  - `src/AI/GameEnv.js` (reset / step simulator with `pass`, immediate fight rounds, turn limit) and `src/AI/Arena.js` (`playGame`, `runMatch`, alternated seats, illegal action → error); `training/arena.mjs` CLI.
  - Docs: D-010, D-011, architecture, conventions, development (arena), AGENTS (map, golden rule 1, learning notes), roadmap. `.gitignore`: `docs/learning/`. Learning notes started in `docs/learning/notes.md` (French, local only).
- **Numbers**: 56/56 tests (44 engine tests unchanged and passing after the refactor + 12 for GameEnv / Arena). Arena, 1,000 games per pairing, seed 1: normal beats random 86.0 %, normal beats easy 80.8 %, easy beats random 59.7 %; ~5,700 games/s; identical output for identical seeds. UI check (`tools/ui-check.mjs`): 72/72, exit code 0.
- **Problems**: found a game bug: a player with no reachable cell cannot pass (game stuck); not fixed, owner decision pending. `createGame` now only marks player 1 as AI when `aiMode` is set and not `'none'` (before: also when `aiMode` was missing; the Store always sets it).
- **Still open**:
  - Owner's check that the game still plays normally (moves, pickups, traps, fights, AI modes).
  - Decision on the blocked-player bug.
  - Phase 7.2: training page + Q-learning for fights.

## 2026-10-08 — Phase 6: automated UI checks

- **Done**: roadmap updated with the owner's new priorities (Phase 6 UI checks, Phase 7 smarter AI, Phase 8 game feel and content; keyboard play rejected). Added `tools/ui-check.mjs` (zero dependency: `node:http` server + headless Chrome via the DevTools protocol and Node's `WebSocket`), `tools/output/` in `.gitignore`, decision D-009, docs (development, architecture), `AGENTS.md` checklist step 4 for UI changes and project map.
- **Numbers**: on the repo, 72/72 cases without issue, exit code 0. On a scratch copy with broken CSS (`#menu` scrollable, 600px player cards), 7 phone-portrait cases failed (board outside the viewport, clipped `.game`), exit code 1.
- **Problems**: the viewport filter is a substring match (`phone-portrait` also selects `iphone-portrait`) — documented.
- **Still open**:
  - Phase 7 (smarter AI) and Phase 8 (game feel and content): scope to validate with the owner.
  - Offline font (Ideas / later): no answer yet.

## 2026-10-08 — Phase 5 Batch C (responsive layout)

- **Done**: Batch B taken as validated (owner said "next"). Batch C:
  - CSS rewritten with fluid sizes (`clamp()` on `vmin`, size variables in `:root`), `100dvh`, no fixed heights; unused utilities removed (`.h150px`, `.h200px`, `.flex`, `.groupBtnColumn`, `.nb-spinner-*`).
  - Game screen: board area + sidebar side by side in landscape, stacked in portrait (player cards side by side); sidebar never scrolls; cell size computed from `.boardArea`, recomputed on resize / rotation (`ResizeObserver`) and on view switch, with a dedicated formula for the isometric view (cells 10–96px). Isometric `margin-right: 10vw` removed.
  - Options: generic grid (3 columns, 2 under 480px), horizontal `− value +` controls with `<output>`, buttons disabled at min / max (U-21). Adding an option no longer needs CSS.
  - Rules dialog centred and fluid, two columns on short landscape screens; fight / trap banners grow with their content, actions on their own line under 600px wide.
  - Docs: ui-design (viewport, layouts, adaptive board, visual identity, known deviations), roadmap, architecture.
- **Numbers**: `node --check` 26/26, 44/44 tests, golden-rule greps OK; CSS braces balanced, every variable defined and used. Headless Chrome (CDP script outside the repo), 8 sizes from 360×640 to 1920×1080 × 9 screens: before 21/72 screens without issue (board invisible on phone portrait, overlapping options on phone landscape, internal scroll, banner / rules out of the viewport), after 72/72 with no page scroll, no element outside the viewport, no scrollable or clipped area. Screenshots reviewed for phone portrait / landscape, tablet and desktop.
- **Problems**: Chrome served cached ES modules at first (stale results); fixed by disabling the network cache in the script. A `-`/`+` button with the pixel border looks heavy at small sizes (cosmetic).
- **Still open**:
  - Validated by the owner on real devices ("c'est bon pour moi"); Phase 3 and Phase 5 closed.
  - Keyboard play on the board (U-04) and offline font (U-07) moved to roadmap "Ideas / later".

## 2026-10-08 — Phase 5 Batch B (playability)

- **Done**: Batch A taken as validated (owner said "next"). Batch B:
  - Board (`BoardView`): reachable cells next to the enemy get a red ring and a "Duel !" tooltip (U-34); the active player's cell pulses (U-35, disabled with `prefers-reduced-motion`); tooltips on characters, weapons (name, damage), bonuses, triggered traps; weapon hover spin removed (U-36).
  - Game screen (`GameView`): "Menu" asks "Quitter la partie ?" before leaving (U-37); rules rewritten to cover movement points, weapon swap, bonuses, traps, duel cells, attack/defend and AI mode (U-41); dialogs close with Escape and outside click, focus moves to their button (U-42).
  - Fight banner (`BattleBanner`): health of both players shown when choosing an action, target health after a hit (U-51); winner and "Nouvelle partie" / "Quitter" shown together, no 1.5 s wait (U-53).
  - CSS: remaining cell / ring colours moved to variables.
  - Docs: ui-design (board and dialog cues), conventions (document listeners cleanup), roadmap.
- **Numbers**: `node --check` 26/26, 44/44 tests (no Engine change), golden-rule greps OK; CSS braces balanced, every variable defined and used, every new class used.
- **Problems**: no browser available to the agent; visual result not checked. `sed -i` turned `css/style.css` to LF line endings; restored to CRLF.
- **Still open**:
  - Owner's browser check of Batch B.
  - Batch C (responsive layout); keyboard play on the board (rest of U-04) to be decided.

## 2026-10-08 — Phase 5 scoped, Batch A (UI quick fixes)

- **Done**: UI/UX audit written in `docs/ui-design.md` (U-01 … U-53, from code). Owner scope recorded in the roadmap: fully responsive on every screen, keep the current style, keep and improve the isometric view, three batches (A quick fixes, B playability, C responsive). Batch A: colour variables in `:root` (U-03); `:focus-visible` on buttons, rules close button is a real `<button>` with `aria-label`, character / weapon names as image `alt` (U-04, partly); spelling "Règles", "Paramètres", "Dégâts" (U-05); no more inline `style` toggles — `.hidden` class and `.game` CSS (U-06); battle and trap modal/banner CSS merged (U-52).
- **Numbers**: `node --check` 26/26, 44/44 tests, golden-rule greps OK; CSS braces balanced, no undefined or unused variable; local server serves the changed files (200).
- **Problems**: no browser available to the agent; the visual result is not checked.
- **Still open**:
  - Owner's browser check of Batch A (menu, options, game, rules modal, isometric toggle, fight and trap banners, keyboard Tab focus).
  - Batch B (playability) and Batch C (responsive layout).
  - Keyboard play on the board (rest of U-04): to be decided.

## 2026-10-08 — Automated tests (Phase 4)

- **Done**: test suite with Node's built-in runner, no dependency ([D-008](../docs/decisions.md#d-008--tests-with-nodes-built-in-test-runner)): `tests/helpers.mjs` + one file per engine (`MovementSystem`, `GameEngine`, `FightEngine`, `AIEngine`). Test command added to the `AGENTS.md` checklist and golden rule 9; development, conventions, architecture and roadmap updated. No source code changed.
- **Numbers**: 44 tests, 44 pass, ~0.1 s (Node v22.14.0). Mutation check on a scratch copy: 6 deliberate bugs (trap damage, defense halving, blocking players, easy-mode odds, AI defend rule, weapon swap) each made exactly one test fail.
- **Problems**: Node prints two harmless warnings (typeless `.js` modules, experimental `mock.timers`), silenced in the documented command.
- **Still open**:
  - Views are not covered by automated tests (manual browser check).
  - Remaining Phase 3 item: internal scroll in `#menu` and `.modalRules` (likely handled in the Phase 5 UI/UX overhaul).

## 2026-10-08 — "Nouvelle partie" keeps the settings

- **Done**: the "Nouvelle partie" button in `BattleBanner` no longer calls `location.reload()` (which reset the Store config to defaults); it hides the battle modal and calls `gameEngine.startGame(store.state.config)`. Spec and roadmap updated.
- **Numbers**: `node --check` OK; golden-rule greps OK. Node simulation: custom config (8×12, 15 obstacles, 5 weapons, 1 bonus, 4 traps, AI easy) → game played to `gameover` → restart: same config, `phase` `playing`, `fight` null, players at full health, AI flag on player 1, item counts match.
- **Problems**: none.
- **Still open**:
  - New characters are drawn at each new game; tell if they should be kept too.

## 2026-10-08 — AI plays its own fight actions

- **Done**: `AIEngine` now listens to `fight:start` / `fight:round-end` and, when the AI is the attacker, calls `fightEngine.attack()` or `defend()` after 1500 ms. Easy: 70 % attack. Normal: finish the enemy if possible, defend if the next enemy hit is lethal, otherwise attack. `BattleBanner` shows "<name> réfléchit…" instead of the buttons on the AI's turn. Docs updated (spec-gameplay, architecture, D-006, roadmap).
- **Numbers**: `node --check` 26/26; golden-rule greps OK. Node simulation, AI vs AI, time accelerated ×50, 30 games per mode: every fight that started ended with `fight:end` and the loser at 0 HP (easy 30/30, normal 27/27; 474 attacks / 192 defends in easy).
- **Problems**: in the simulation, 3/30 normal-vs-normal games never reached a fight: both AIs oscillate between two cells forever (existing movement strategy). Only possible with two AIs, which the game does not offer; not fixed.
- **Still open**:
  - Remaining Phase 3 item: internal scroll in `#menu` and `.modalRules`.

## 2026-10-08 — Migrate agent context to AGENTS.md, docs/ and devlog

- **Done**: split the former `CLAUDE.md` (28 information blocks) into `AGENTS.md`, `docs/` (architecture, development, conventions, ui-design, spec-gameplay, decisions, roadmap) and this devlog; added `ATTRIBUTION.md`; traceability map in `docs/archive/migration-map-2026-10-08.md`. Documentation aligned with the code (added `AIEngine`, `aiMode`, `isAI`, `Store.reset()`, completed "Add a …" checklists, widened the Engine-import rule to `BattleBanner` — D-007). No source code changed.
- **Numbers**: 28 blocks migrated (1 merged). `node --check` passes on 26/26 files; `python -m http.server` serves `index.html` and `src/app.js` (200).
- **Problems**: the agent is not allowed to modify its own configuration (`CLAUDE.md`, `.claude/`); the owner archived the original `CLAUDE.md`, installed the new one and `.claude/settings.json` by hand. `.gitignore` no longer ignores `CLAUDE.md` (owner decision). `MIGRATION_PROMPT.md` deleted at the end (owner decision).
- **Still open**:
  - `npx serve .` not verified.
  - Bugs to fix (roadmap Phase 3): internal scroll in `#menu` and `.modalRules` (AI fight bug fixed, see above).
  - Automated tests to set up (Phase 4); UI/UX overhaul to scope (Phase 5).
  - Roadmap "Current focus" and "Ideas / later" left for the owner.
  - Image sources unknown (`ATTRIBUTION.md`).

## Before 2026-10-08 (migrated)

From git history only (no session notes existed):

- **2026-04-12** — `ca9e75f` "update: IA test": AI opponent (`AIEngine`, `aiMode` option, `isAI` flag).
- **2026-03-09** — `eddd594` "refactor global": architectural rewrite of BoardGame into the layered vanilla JS architecture.
