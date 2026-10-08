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
