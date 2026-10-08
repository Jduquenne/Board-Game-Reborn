# Migration map — 2026-10-08

Traceability of every information block from the former context file to its new home.

Source: `CLAUDE.md` (136 lines), archived as `docs/archive/CLAUDE-2026-10-08.md`. No other context file existed (`memory.md` absent, no `.claude/` folder).

| Block | Source | Summary | Destination | Status |
|---|---|---|---|---|
| B-001 | `CLAUDE.md` l. 1–3 | Architectural rewrite of BoardGame, same game and gameplay, vanilla JS, no dependency | `AGENTS.md` § Preamble; `docs/decisions.md` § D-001 (context) | migrated |
| B-002 | l. 5–13 | Native ES modules require a local HTTP server (`python3 -m http.server 8080` or `npx serve .`) | `docs/development.md` § Run locally | migrated |
| B-003 | l. 15 | Assets are in `assets/`, local to the project | `docs/architecture.md` § Asset resolution | migrated |
| B-004 | l. 19 | Vanilla JS ES2022: private fields, `Object.freeze`, `structuredClone` | `docs/conventions.md` § Language | migrated (corrected: `structuredClone` unused, noted) |
| B-005 | l. 20 | Zero dependency: no jQuery, no bundler, no npm | `AGENTS.md` § Absolute rules; `docs/decisions.md` § D-001 | migrated |
| B-006 | l. 21 | Native ES modules, import/export everywhere | `docs/decisions.md` § D-002; `docs/conventions.md` § Language | migrated |
| B-007 | l. 23–30 | The 4 layers (core, Engine, Repository, Views) | `docs/architecture.md` § Layers; `docs/decisions.md` § D-003 | migrated (Models layer made explicit) |
| B-008 | l. 32–66 | Full `src/` tree | `docs/architecture.md` § Directory structure; short version in `AGENTS.md` § Project map | migrated (corrected: `AIEngine.js` added) |
| B-009 | l. 70–81 | EventBus events table | `docs/architecture.md` § Events | migrated |
| B-010 | l. 83–93 | Store state shape | `docs/architecture.md` § State shape | migrated (corrected: `aiMode` added) |
| B-011 | l. 95–103 | Component lifecycle and `listen()` | `docs/architecture.md` § Core infrastructure | migrated (`query`/`queryAll` added) |
| B-012 | l. 105–109 | Router usage | `docs/architecture.md` § Core infrastructure; `docs/decisions.md` § D-005 | migrated |
| B-013 | l. 113 | Engine: never `document`, `querySelector` or DOM | `AGENTS.md` § Golden rules; `docs/conventions.md` § Layer rules | migrated |
| B-014 | l. 114 | Views: no business logic, no Engine import except GameView/BoardView | `AGENTS.md` § Golden rules; `docs/conventions.md` § Layer rules; `docs/decisions.md` § D-007 | migrated (amended with owner approval: + BattleBanner) |
| B-015 | l. 115 | Models: pure factories, no methods | `AGENTS.md` § Golden rules; `docs/conventions.md` § Layer rules | migrated |
| B-016 | l. 116 | Repositories: `findAll()` returns new instances | `AGENTS.md` § Golden rules; `docs/conventions.md` § Layer rules | migrated |
| B-017 | l. 117 | Store: only `setState(updater)` modifies state | `AGENTS.md` § Golden rules; `docs/conventions.md` § Layer rules | migrated |
| B-018 | l. 121 | No scroll, everything within 100vw/100vh | `AGENTS.md` § Golden rules; `docs/ui-design.md` § Viewport constraints | migrated |
| B-019 | l. 122 | Responsive, no overflow | `docs/ui-design.md` § Viewport constraints | migrated |
| B-020 | l. 123 | Adaptive board, `--cell-size` computed by GameView | `docs/ui-design.md` § Adaptive board | migrated |
| B-021 | l. 124 | `html`, `body`, `#app` → `overflow: hidden` | `AGENTS.md` § Golden rules; `docs/ui-design.md` § Viewport constraints | merged with B-018 |
| B-022 | l. 125 | Fixed heights forbidden if they overflow | `docs/ui-design.md` § Viewport constraints | migrated |
| B-023 | l. 131 | New character → `PLAYER_DATA` | `docs/conventions.md` § Add a character | migrated (completed: image step) |
| B-024 | l. 132 | New weapon → `WEAPON_DATA` | `docs/conventions.md` § Add a weapon | migrated (completed: image step) |
| B-025 | l. 133 | New bonus → `BONUS_DATA` | `docs/conventions.md` § Add a bonus | migrated (completed) |
| B-026 | l. 134 | New view → `Views/MyView.js` + `router.register` | `docs/conventions.md` § Add a view / page | migrated |
| B-027 | l. 135 | New config option → `OPTIONS` | `docs/conventions.md` § Add a configuration option | migrated (completed: Store default) |
| B-028 | l. 136 | New cell type → `DECOR` + GameEngine + BoardView | `docs/conventions.md` § Add a cell type | migrated (completed: MovementSystem, AssetManager) |

## Statistics

- migrated: 27
- merged: 1 (B-021 → B-018)
- moved out of repo: 0
- dropped: 0
- pending decision: 0

## Owner decisions taken during the migration (2026-10-08)

- Repository docs in English; code comments and UI stay in French.
- Remove `CLAUDE.md` from `.gitignore`.
- Delete `MIGRATION_PROMPT.md` after the migration.
- Contradictions between old docs and code: align docs on the code; widen the Engine-import rule (D-007).
- Create `docs/spec-gameplay.md` derived from code.
- Record decisions D-001…D-005 as accepted, D-006 as proposed.
- The agent never runs git commands that modify the repository (read-only allowed); commit messages in Conventional Commits are proposed after each feature/fix/refactor.
- Roadmap filled from code; owner will complete it afterwards.
