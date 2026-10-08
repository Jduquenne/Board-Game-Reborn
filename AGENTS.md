# AGENTS.md — BoardGame Reborn

## Preamble

BoardGame Reborn is an architectural rewrite of BoardGame: same game, same gameplay — a turn-based two-player duel on a grid (with an optional AI opponent) — rebuilt as a clean, scalable vanilla JavaScript codebase.

- **Stack**: vanilla JS ES2022, native ES modules, HTML + one CSS file. Runs in the browser from a static HTTP server.
- **Non-negotiable**: zero dependencies (no npm, no bundler, no framework); strict layer separation; the game always fits the viewport without scrolling.
- **Languages**: the agent talks to the owner in **French**; everything written in the repository docs is in **English**; code comments and UI text stay in **French**. Exception: the owner's personal learning notes in `docs/learning/` are in **French** and git-ignored ([D-011](docs/decisions.md#d-011--personal-learning-notes-in-french-git-ignored)).

Read this file first, then the relevant file in `docs/`.

## Session protocol

1. At the start of each session, read `AGENTS.md`, "Current focus" in [`docs/roadmap.md`](docs/roadmap.md) and the latest entries of [`log/devlog.md`](log/devlog.md).
2. Propose a plan.
3. Wait for the owner's validation before any non-trivial task.
4. Implement.
5. Verify (see [Before you finish a task](#before-you-finish-a-task)).
6. Write the devlog entry.
7. Propose a commit message.

## Absolute rules

- **Git belongs to the owner.** Read-only commands (`git status`, `git diff`, `git log`, `git show`) are allowed. Any command that modifies the repository (`init`, `add`, `commit`, `push`, `pull`, `merge`, `rebase`, `reset`, `checkout`, `switch`, `stash`, `tag`, `branch`, `clean`, `restore`, `remote`…) is never run without the owner's explicit permission.
- Architecture decisions are proposed, validated by the owner, then recorded in [`docs/decisions.md`](docs/decisions.md).
- Never move to the next roadmap phase without the owner's agreement.
- Never add a dependency, `package.json` or bundler ([D-001](docs/decisions.md#d-001--zero-dependencies)); never invent a version number.
- No out-of-scope work: do what was asked, propose the rest.
- Be honest about status: say what was not verified (e.g. no in-browser test).

## Orientation

| Read | Why |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Layers, directory structure, core infrastructure, events, state shape, data flow, data model |
| [`docs/development.md`](docs/development.md) | How to run the game locally, syntax check, debugging |
| [`docs/conventions.md`](docs/conventions.md) | Code style, naming, layer rules in detail, commit format, "Add a …" checklists |
| [`docs/ui-design.md`](docs/ui-design.md) | Viewport / no-scroll rules, adaptive board, visual identity, known deviations |
| [`docs/spec-gameplay.md`](docs/spec-gameplay.md) | Game rules: setup, movement, pickups, traps, fights, AI |
| [`docs/roadmap.md`](docs/roadmap.md) | Current focus, honest status, phases, ideas |
| [`docs/decisions.md`](docs/decisions.md) | Architecture decisions (ADR) |
| [`log/devlog.md`](log/devlog.md) | What was done in each session, what is still open |
| [`ATTRIBUTION.md`](ATTRIBUTION.md) | Third-party fonts and images |
| `docs/learning/` (local only, git-ignored) | Owner's AI-training learning notes, in French, for a beginner. Update them whenever a task introduces a new AI / machine-learning concept |

## Project map

```text
index.html          ← loads css/style.css and src/app.js
css/style.css       ← all styles
assets/dungeon/     ← images (characters, weapons, bonus, trap, tiles)
src/
├── app.js          ← entry point, routes: menu, options, game
├── AssetManager.js ← the only place that builds image paths
├── core/           ← EventBus, Store, Component, Router
├── Engine/         ← Rules (pure game rules), GameEngine, FightEngine, AIEngine, MovementSystem (no DOM)
├── AI/             ← agents, GameEnv simulator, Arena (no DOM; shared by the game and training)
├── Models/         ← createCell/Player/Weapon/Bonus/Trap factories
├── Repository/     ← static game content (PLAYER_DATA, WEAPON_DATA…)
└── Views/          ← Menu, Options, Game + Board, PlayersSidebar, BattleBanner, TrapBanner, Training (AI training page)
training/           ← Node scripts to evaluate / train AI agents (see D-010)
tests/              ← node:test suites for src/Engine/ and src/AI/ (see D-008)
tools/ui-check.mjs  ← responsive UI check in headless Chrome (see D-009)
docs/               ← project documentation (archive/ = original context files)
log/devlog.md       ← session journal
```

Details: [`docs/architecture.md`](docs/architecture.md#directory-structure).

## Golden rules

1. Never reference `document`, `window` or any DOM API in `src/Engine/`, `src/AI/`, `src/Models/` or `src/Repository/`.
2. Only `GameView`, `BoardView` and `BattleBanner` may import from `src/Engine/`, only to dispatch user actions.
3. Never put game rules in Views: they render state and forward user actions.
4. Models are pure factory functions — no methods, no classes.
5. `Repository.findAll()` always returns fresh instances.
6. State changes only through `store.setState(updater)`.
7. No page scroll: `html`, `body`, `#app` keep `overflow: hidden`; every view fits in 100vw × 100vh.
8. Never add a dependency, `package.json` or bundler.
9. Every JS file must pass the syntax check (checklist step 1); every game-rule change in `src/Engine/` comes with a test and all tests pass.
10. When adding an event or a state key, update [`docs/architecture.md`](docs/architecture.md) in the same task.

Verification for rules 1–2:

```bash
grep -rnE "document|window" src/Engine src/AI src/Models src/Repository   # must print nothing
grep -rln "Engine/" src/Views                                       # only GameView, BoardView, BattleBanner
```

Details: [`docs/conventions.md`](docs/conventions.md#layer-rules) and [`docs/ui-design.md`](docs/ui-design.md).

## Picking work

1. "Current focus" in [`docs/roadmap.md`](docs/roadmap.md).
2. Then "Still open" in the latest [`log/devlog.md`](log/devlog.md) entry.
3. Anything else: ask the owner first.

## Before you finish a task

1. Syntax check: `for f in $(find src tools training tests -name "*.js" -o -name "*.mjs" | grep -v output); do node --input-type=module --check < "$f" || echo "FAIL $f"; done` (no `FAIL` line = OK). Do not use plain `node --check file.js`: with Node 22 it does not report syntax errors in our ES module files.
2. Tests: `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning` (must end with `# fail 0`).
3. Golden-rule greps (rules 1–2 above).
4. If the change touches the UI (`css/`, `src/Views/`, `index.html`): `node tools/ui-check.mjs` (must end with exit code 0) and look at the screenshots of the affected screens in `tools/output/`.
5. Run `python -m http.server 8080` and check the affected screens at <http://localhost:8080>; if you could not test in a browser, say so.
6. Add an entry to [`log/devlog.md`](log/devlog.md).
7. Update [`docs/roadmap.md`](docs/roadmap.md) (and `docs/` if architecture, rules or conventions changed).
8. Propose a commit message in Conventional Commits format (see [`docs/conventions.md`](docs/conventions.md#commit-messages)) — never commit.

There is no build, lint or formatter. Tests cover `src/Engine/` only; layout is checked by `tools/ui-check.mjs`; gameplay feel still needs the browser check (step 5).

## Where things are tracked

- Plan and status: [`docs/roadmap.md`](docs/roadmap.md)
- Decisions: [`docs/decisions.md`](docs/decisions.md)
- Session history: [`log/devlog.md`](log/devlog.md)
- Original context files and migration map: [`docs/archive/`](docs/archive/)
