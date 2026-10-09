# Architecture decisions

Lightweight ADR log. New decisions are proposed by the agent, validated by the owner, then recorded here.

Format: `## D-xxx — Title` · Date · Status (accepted / proposed / superseded / rejected) · Context · Decision · Alternatives considered · Consequences.

## D-001 — Zero dependencies

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: BoardGame Reborn is an architectural rewrite of BoardGame (same game, same gameplay) aiming for a clean, scalable vanilla JS codebase.
- **Decision**: no third-party dependency — no jQuery, no bundler, no npm.
- **Alternatives considered**: not documented.
- **Consequences**: no `package.json`; no test runner or linter out of the box; everything (EventBus, Store, Router, Component) is hand-written in `src/core/`.

## D-002 — Native ES modules, no bundler

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: follows from D-001.
- **Decision**: `import` / `export` everywhere, loaded natively by the browser (`<script type="module">`).
- **Alternatives considered**: not documented.
- **Consequences**: a local HTTP server is mandatory ([development](development.md#run-locally)); imports use relative paths with the `.js` extension.

## D-003 — Layered architecture

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: separate game logic from rendering.
- **Decision**: `core/` (infrastructure), `Engine/` (pure logic, no DOM), `Models/` (factories), `Repository/` (static data), `Views/` (DOM, no business logic). See [architecture](architecture.md#layers-and-allowed-dependencies).
- **Alternatives considered**: not documented.
- **Consequences**: engine logic can be reasoned about without the DOM; views react to events and state.

## D-004 — Centralised immutable Store + EventBus

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: views and engines need shared state and notifications.
- **Decision**: a single `Store` whose state changes only through `setState(updater)` and emits `state:changed`; domain events go through a pub/sub `EventBus`.
- **Alternatives considered**: not documented.
- **Consequences**: engines clone data before updating; components subscribe with `listen()` and are cleaned up on `unmount()`.

## D-005 — Hash-based router

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: navigation between menu, options and game without a server.
- **Decision**: `Router` with `register` / `navigate` / `start`, using `location.hash` and `popstate`.
- **Alternatives considered**: not documented.
- **Consequences**: works with any static server; each navigation unmounts the current view.

## D-006 — AI driven by `turn:changed`

- **Date**: unknown, before migration (code added around 2026-04-12, commit "update: IA test")
- **Status**: proposed
- **Context**: the game offers single-player modes (`easy`, `normal`).
- **Decision**: `AIEngine` listens to `turn:changed`; if the active player has `isAI`, it waits 900 ms then calls `gameEngine.movePlayer`. Since 2026-10-08 it also listens to `fight:start` and `fight:round-end`; if the attacker has `isAI`, it waits 1500 ms (longer than the `BattleBanner` display delays) then calls `fightEngine.attack()` or `defend()`. The player at index 1 is always the AI when an AI mode is selected. `GameView` starts/stops the AI on mount/unmount.
- **Alternatives considered**: not documented.
- **Consequences**: the AI uses the same public engine API as a human player. `BattleBanner` hides the action buttons when the attacker is the AI. The fight delay is coupled to the banner delays.

## D-015 — Balance lab: stats edited in the lab only

- **Date**: 2026-10-08
- **Status**: accepted
- **Context**: the balance analysis (`training/balance.mjs`) showed strongly unbalanced characters; the owner wants to edit stats on the fly and see the effect visually.
- **Decision**: page `#balance` (button "Équilibrage" on the training page) running the shared analysis `src/AI/Balance.js` in a Web Worker. Stats edited there are used **only by the lab** (option A chosen by the owner); "Copier les stats" gives them in the `PLAYER_DATA` format so that a change of the game's characters is a deliberate, recorded game-design decision.
- **Alternatives considered**: option B — "Appliquer au jeu" storing edited stats in the browser and using them in the game (rejected for now: the game would change without any trace in the code).
- **Consequences**: no risk of silently changing the game; one source of truth for the analysis (CLI and page). The lab will be the tool to balance future game-design changes (new stats, weapon affinities).

## D-014 — Hand-written neural network; movement first learned by imitating the champion

- **Date**: 2026-10-08
- **Status**: accepted (Phase 7.4a–b)
- **Context**: the genetic movement (D-013) is limited by the 9 hand-chosen features; a neural network can build its own from raw inputs. The owner is a beginner: the path must be understandable step by step.
- **Decision**:
  - `src/AI/NeuralNetwork.js`: generic multilayer perceptron written by hand (He initialisation, ReLU / tanh, linear output, backpropagation, SGD and Adam), verified by a numerical gradient check and XOR.
  - Network inputs per reachable cell (`NeuralMovePolicy.js`): a 5 × 5 view (blocked, weapon, life / move bonus, enemy, triggered trap) + 9 globals = 159 numbers, only visible information. Network 159 → 32 → 16 → 1 (5,665 parameters); the agent moves to the best-scored cell.
  - First training = supervised imitation of the genetic champion (`ImitationTrainer.js`, behavioural cloning): 80 / 20 train / test split by game, softmax cross-entropy, **distillation** targets (softmax of the champion's scores, temperature 0.25) instead of hard labels, Adam (lr 0.003, batches of 32). The champion's weights are shipped in `DefaultModels.js`.
  - Training page lesson "Réseau de neurones (imitation)" with training / test loss curves; a saved network becomes the "IA Entraînée" movement model.
  - Reinforcement learning on top of the imitating network is the next step (7.4c).
- **Alternatives considered**: hard labels (overfit: ties are broken arbitrarily by the champion, 87 % train vs ~38 % test accuracy); plain SGD (too slow with distillation); a 7 × 7 view (no better, twice as slow); start directly with deep reinforcement learning (unstable, hard to debug for a first network).
- **Consequences**: the network beats Normal (54–57 %) without hand-made features but stays well below its teacher (70.5 %): it cannot rebuild from local pixels the key "can the enemy reach me next turn?" reasoning that the champion receives ready-made. Evaluating a network is slower (~0.4 s for 200 games in Node), so the lesson evaluates on 200 games.

## D-013 — Movement learned by a genetic algorithm on a weighted score of cells

- **Date**: 2026-10-08
- **Status**: accepted (Phase 7.3)
- **Context**: fights are mostly decided before they start (D-012), so the margin is in movement; the full movement state is far too large for a Q-table.
- **Decision**:
  - Each reachable cell gets a score = Σ weight × feature, with 9 features computed only from information visible to a player (duel cell, advantage when striking first, weapon gain, life / move bonus, distance to the enemy, exposed to an enemy first strike and its danger, distance to a better weapon) — `src/AI/MoveFeatures.js`.
  - The 9 weights are evolved by a generic genetic algorithm (`src/AI/Genetic.js`: elitism 3, tournament 3, uniform crossover, Gaussian mutation 0.3 / 0.3, population 30). Fitness = win rate (draw = ½) over 60 games against the opponent, all individuals of a generation on the same games.
  - The training page gets lessons (`FightLesson`, `MoveLesson`) behind one interface; `TrainingSession` only handles speed and messages. Models are stored per lesson (`ModelStorage.save/load('fight' | 'move')`); "IA Entraînée" combines them.
- **Alternatives considered**: Q-learning on movement (state space too large without a neural network — Phase 7.4); hand-tuning the weights (that is what the algorithm automates).
- **Consequences**: first AI that clearly beats Normal: ~66–72 % against Normal, and it generalises to other opponents (95 % vs random, 92 % vs easy, against 84 % / 81 % for Normal). The learned behaviour is only as rich as the features chosen by hand.

## D-012 — First learning: tabular Q-learning of fight decisions, training page in a Web Worker

- **Date**: 2026-10-08
- **Status**: accepted (Phase 7.2)
- **Context**: first hands-on training step for a beginner; the owner wants a page to watch the training with a speed control up to "very, very fast".
- **Decision**:
  - Learn only attack / defend first, with a tabular Q-learning (`src/AI/QLearning.js`, generic) on a compact observation: hits needed by each side (1–10) and both defense flags (`src/AI/FightPolicy.js`, at most 400 situations). Reward only at the end of the game (+1 / −1 / 0). Blank table = small random values (the untrained AI fights at random); α = 0.05, γ = 0.95, ε from 1 to 0.05. Update 2026-10-09 (game design batch 7): γ = 1 for fights — with γ = 0.95 delayed wins (after a flee or a defense) were undervalued and the learner plateaued at ≈ 46 % against IA Normal; γ = 1 reaches ≈ 50 % (5 seeds, 100,000 games). Safe because sudden death guarantees that every game ends.
  - Training page `#training` (`TrainingView`) talking by messages to a Web Worker (`TrainingSession`): speeds Regarder / Rapide (board frames) and Turbo / Max (batches of games, stats 5×/s). Evaluation on 400 fixed games (seed 777) against the opponent, compared with Normal's fight rule on the same games.
  - The trained table is saved in `localStorage` (`ModelStorage`) and used by the new "IA Entraînée" mode; without a model it falls back to Normal.
- **Alternatives considered**: start with the whole game or movement (state space far too large for a table); train in the main thread (page frozen at high speed); save models as files in the repository (needs a build or manual copy step — possible later).
- **Consequences**: first measured result: from ~12 % to the level of Normal's hand-written rule (~51.5 %) in ~3,000 games, but not above — fights are mostly decided by health and weapons at the start, so the real gains are expected from movement (7.3). The model lives in one browser only (no sharing yet).

## D-011 — Personal learning notes in French, git-ignored

- **Date**: 2026-10-08
- **Status**: accepted
- **Context**: the owner wants to learn AI training through this game (beginner level) and keep the notes for personal use only.
- **Decision**: learning notes live in `docs/learning/`, written in French for a beginner, ignored by git (`.gitignore`). The agent updates them whenever a task introduces a new AI / machine-learning concept.
- **Alternatives considered**: English notes in the repository (rejected by the owner).
- **Consequences**: exception to the "repository docs in English" rule; the notes exist only on the owner's machine and are not part of the project documentation (nothing in `docs/` may depend on them).

## D-010 — Pure game rules, simulator and agents for AI training

- **Date**: 2026-10-08
- **Status**: accepted (Phase 7.1)
- **Context**: the owner's main goal is to train an AI for the game and learn how to do it for other games. Training needs thousands of games per second; the engines were tied to the Store, the EventBus and display delays.
- **Decision**:
  - Game rules are extracted into pure functions in `src/Engine/Rules.js` (`state → { state, events }`); `GameEngine` / `FightEngine` only apply them to the Store, emit the events and keep the display delays.
  - `src/AI/` holds what the game and training share, with no DOM, Store or EventBus: agents (`chooseMove`, `chooseFightAction`), `GameEnv` (reset / step simulator, the usual "environment" interface of reinforcement learning) and `Arena` (agent vs agent, seeded with `core/Random.js`).
  - `AIEngine` plugs an agent into the running game; `training/` holds Node scripts (arena now, training later).
  - Everything is written by hand, without libraries (D-001), so every algorithm can be read and understood.
- **Alternatives considered**: keep the engines and mock timers in simulations (too slow, couples training to the UI); a JS ML library such as TensorFlow.js (rejected by D-001 and by the learning goal).
- **Consequences**: one source of truth for the rules (a rule change applies to both the game and the simulator); engine tests still cover the game behaviour, `tests/GameEnv.test.mjs` covers the simulator. `BoardView` also renders during the `fighting` phase (a move that starts a duel is now a single state update).

## D-009 — Automated UI checks with headless Chrome

- **Date**: 2026-10-08
- **Status**: accepted
- **Context**: the responsive layout (Phase 5) was verified with a throw-away script driving headless Chrome; the owner agreed to keep it (Phase 6) so every UI change can be checked on all screen sizes.
- **Decision**: `tools/ui-check.mjs`, a zero-dependency Node script: it serves the project with `node:http`, starts the locally installed Chrome / Chromium / Edge in headless mode and drives it through the DevTools protocol with Node's built-in `WebSocket`. It opens every screen at 8 screen sizes, fails when it finds a page scroll, an element outside the viewport, a scrollable area or clipped content, and saves a screenshot per case in `../BoardGameReborn-output/ui-check/`, next to the project (temporary Chrome profiles in the same folder). History, 2026-10-08: first written to `tools/output/` inside the project, which made the owner's auto-reloading dev server (Live Server) reload the game every few seconds; then to the system temp directory, which is on drive C: — forbidden by the owner; now next to the project on the same disk.
- **Alternatives considered**: Playwright / Puppeteer (rejected by D-001); manual checks only (too slow for 72 cases).
- **Consequences**: requires a Chromium-based browser on the machine (`CHROME_PATH` if not found) and Node with a global `WebSocket` (verified with v22.14.0). It checks layout, not visual taste: screenshots still need a look. Since 2026-10-08 it also fails on JavaScript errors in the page and on an empty `#app` (a page that does not load would otherwise pass every layout check). It drives the game through ES module imports in the page (`store`, `eventBus`), so renaming those modules or events requires updating the script.

## D-008 — Tests with Node's built-in test runner

- **Date**: 2026-10-08
- **Status**: accepted
- **Context**: the owner decided to add automated tests (roadmap Phase 4) without breaking D-001.
- **Decision**: tests use Node's built-in runner and assertions (`node:test`, `node:assert/strict`), no library, no `package.json`. They live in `tests/` as `*.test.mjs` and cover `src/Engine/` (plus `core/` and `Models/` indirectly). Randomness is controlled by building the board by hand (`tests/helpers.mjs`) or mocking `Math.random`; delays with `mock.timers`. Node is a development tool only — the game still runs in the browser without it.
- **Alternatives considered**: a browser-based test page (harder to run from the terminal); a test library via npm (rejected by D-001).
- **Consequences**: Views (DOM) are not covered by automated tests and still need manual checks in a browser. Node prints two expected warnings: `.js` files are reparsed as ES modules (no `package.json` `"type"`), and `mock.timers` is experimental in Node 22.

## D-007 — BattleBanner may import FightEngine

- **Date**: 2026-10-08
- **Status**: accepted
- **Context**: the original rule allowed only `GameView` and `BoardView` to import from `Engine/`, but `BattleBanner` calls `fightEngine.attack()` / `defend()` from its buttons.
- **Decision**: the rule is widened: `GameView`, `BoardView` and `BattleBanner` may import from `Engine/`, only to dispatch user actions.
- **Alternatives considered**: keep the rule and route fight actions through `GameView` or the EventBus.
- **Consequences**: the documentation matches the code; no code change.
