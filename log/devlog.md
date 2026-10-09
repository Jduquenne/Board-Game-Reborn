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

## 2026-10-09 — Game design batch 5: character classes

- **Done**: owner approved the class templates (budget STR + AGI + LCK = 9; Brute 7/1/1 PM 2, Ent 2/6/1 PM 2, Thief 1/2/6 PM 5, Duellist 4/5/0 PM 3), a ±1 point variation per character (seed 2026) and replacing the previous draft. `createPlayer` gets `characterClass` (`CHARACTER_CLASS`, French labels `CHARACTER_CLASS_LABEL`); `PlayersRepository` exports `CLASS_TEMPLATES` / `STAT_BUDGET`; `PLAYER_DATA` rewritten (all at 100 HP). Class shown in the sidebar (under the name) and in the Balance lab row tooltip; "Copier les stats" and `auto-balance.mjs` output keep the class; `balance.mjs` prints the class and a class-against-class table. Docs: spec-game-design (batch 5 🟡), spec-gameplay, architecture, conventions, roadmap.
- **Numbers**: 150/150 tests (4 new in `tests/Classes.test.mjs`). Balance at 100 HP (IA Normal, 400 games per pair): 37.5–59.8 %; by class Thief 57.5 %, Duellist 49.7 %, Brute 48.1 %, Ent 41.0 %; Thief beats every class (56–63 %), Ent loses to every class. Auto-tuning (10 passes): 46.9–50.2 %, check on other maps 47.3–50.9 % — Ent 106–115 HP, Thief 91–96 HP, others 100–102 HP. UI check (targeted, game / iso / fight / flee / trap / win): 48/48.
- **Problems**: two learning tests failed with the new stats (more dodges, criticals and flees make learning noisier): fight Q-learning reached 28 % after 5,000 games (threshold 30 %) → now 20,000 games (42 %); imitation test loss rose on 80 games → now 160 games. Thresholds unchanged.
- **Still open**: owner's approval of the tuned health values; no counters yet (Thief dominates before tuning) — health alone flattens the overall rates but not the matchups; owner's check in the browser (not done by me).

## 2026-10-09 — Game design batch 4: weapon types

- **Done**: `createWeapon(name, damage, image, type)` with `WEAPON_TYPE` (heavy / light / balanced, default balanced) and French labels `WEAPON_TYPE_LABEL`. `Rules.js`: heavy weapon → 7 % per Strength point instead of 5 % (`weaponDamage`, so every AI sees it); light weapon → +10 % critical chance, cap 50 % instead of 40 % (owner's choice; `criticalChance(player, weapon)`). `WEAPON_DATA`: first-draft mapping, 4 weapons per type (owner: "un premier jet pour tester"). UI: type shown in the sidebar, the board tooltip and the rules modal. Docs: spec-gameplay, architecture, conventions, spec-game-design (batch 4 ✅), roadmap.
- **Numbers**: 146/146 tests (5 new in `tests/WeaponTypes.test.mjs`). Balance (IA Normal, 400 games per pair): 42.1–55.9 % (before: 42.6–58.5 %), first player 55.7 %, draws 2.1 %. UI check 144/144; rules and game screenshots checked (phone portrait / landscape, desktop).
- **Problems**: none. Owner remarked that the full UI check (8 sizes × 18 screens) is overkill when only one screen changed — the tool already has `--screen` / `--viewport` filters.
- **Update**: owner approved targeted UI checks: `AGENTS.md` step 4 and `docs/development.md` now say to run only the affected screens (`--screen`) for a change limited to a few views, and the full run for shared CSS, global layout or `index.html`.
- **Still open**: owner's check in the browser (not done by me); batch 5 (classes).

## 2026-10-08 — Flee: the player chooses the escape cell

- **Done**: owner's feedback: the flee went to an automatic cell (the farthest one), the owner wants to choose it. `Rules.js`: `fleeOptions` (all reachable cells not next to the enemy — diagonal counts as not next to it), `fleeDestination` = farthest option (AIs), `markEscapeCells` / `clearEscapeCells` (new cell flag `isEscape`), `applyFlee(state, rng, target)` validates the chosen cell and clears the markings after a failure. `FightEngine.flee(target)`, `startFleeSelection()`, `cancelFleeSelection()`. Board: escape cells in green (`.fleeTarget`), click → flee there. Fight banner: "Fuir" opens the choice — banner at the top, semi-transparent, clicks go through to the board except on "Annuler". `ui-check`: screen "flee-choice".
- **Numbers**: 141/141 tests (5 new: options incl. diagonals, chosen cell, invalid cell refused, marking / clearing, full in-game choice). UI check 144/144 (8 sizes × 18 screens).
- **Problems**: one new test had a wrong expectation (diagonal cells counted as next to the enemy) — fixed the test, the rule was right. The top banner covered the board's first row; made it click-through.
- **Still open**: session ended by the owner after this entry. Resume with game design **batch 4 (weapon types)** — see roadmap "Current focus". No background process left running.

## 2026-10-08 — Game design batch 3: flee

- **Done**:
  - `Rules.js`: `fleeChance` = (Luck + 2) / (Luck + enemy Agility + 4) clamped 10–90 %; `fleeDestination` = reachable cell farthest from the enemy and not next to it (null → flee impossible); `applyFlee(state, rng)`: success ends the fight (defenses reset) and moves the fleer with the normal move rule (pickups, traps, turn to the enemy), failure keeps the fight (the enemy plays next). Event `fight:flee`.
  - `FightEngine.flee()` (no round end after a successful flee), `GameEnv` action `flee`, `AIEngine` plays `flee`.
  - Normal AI: if the next enemy hit is lethal → flee when chance ≥ 50 % and an escape exists, else defend (unless already defending).
  - Q-learning: 3rd action `flee`; observation gets the flee chance in tenths or `x` when impossible (key `myHits|enemyHits|myDef|enemyDef|flee`); `QTable.best/choose` take the allowed actions; strategy map shows "fuir" in green. Fight models saved before this change must be retrained.
  - Fight banner: "Fuir (xx %)" button (only when an escape cell exists), messages "X s'enfuit !" / "X tente de fuir… mais Y le retient !".
  - Docs: spec-gameplay, architecture (event), spec-game-design (batch 3 ✅), roadmap.
- **Numbers**: 136/136 tests (11 new in `tests/Flee.test.mjs`, AI fight tests updated: flee when an escape exists, defend / attack when cornered). Balance (IA Normal, 400 games per pair): 41.8–55.9 %, movement points now matter — 1-PM characters 42–45 %, 4–5-PM characters 54–56 %. Fight learning with flee: 6 % → ~45 % after 5,000 games, plateau 40–47 % against Normal's rule (51 %) — the fight-learning test now checks clear progress (< 15 % → > 30 %). UI check: superseded by the next entry (run interrupted, state changed).
- **Problems**: the learned fight policy no longer reaches the scripted rule (delayed consequences of fleeing) — for batch 7.
- **Still open**: owner's check; re-run the health auto-tuning with flee (batch 5); batch 4 (weapon types).

## 2026-10-08 — Tuned health applied; game design batch 2: criticals and dodge

- **Done**:
  - Owner approved: tuned health values written into `PLAYER_DATA` (owner's draft PM / Strength kept). Balance check: 42.6–58.5 % (IA Normal, 400 games per pair).
  - Batch 2: `Rules.js` constants and helpers `criticalChance` (Agility × 3 %, max 40 %, × 1.5) and `dodgeChance` (Luck × 3 %, max 35 %); `applyAttack(state, rng)` resolves dodge, then critical, then defense; no random draw when a chance is 0 (reproducibility); event `fight:attack` gets `critical` and `dodged`. `GameEnv` passes its seeded rng, the game uses `Math.random`. Fight banner: "Coup critique !" / "… esquive l'attaque". Balance lab: Agility and Luck columns, header row instead of per-input labels, fixed-width avatars and headers so the columns of the independent row grids line up.
  - Docs: spec-gameplay (attack resolution), architecture (event payload), spec-game-design (batch 2 ✅), roadmap.
- **Numbers**: 123/123 tests (7 new: chances and caps, no draw at 0, dodge, failed dodge, critical before defense, strength × critical = 90, no critical on a dodge, balance effect of Agility / Luck and reproducibility). Balance screens 24/24 after two layout fixes. Full UI check: 136/136.
- **Problems**: tablet landscape clipped long names after adding two columns; header labels were misaligned (each row is its own grid) — both fixed, the misalignment was only visible on the screenshots.
- **Still open**: owner's check; giving characters Agility / Luck (batch 5) — with randomness in fights, fine health tuning should now converge; batch 3 (flee).

## 2026-10-08 — Owner's first character draft; automatic health tuning

- **Done**: the owner wrote a first draft in `PLAYER_DATA` (5 × 3 grid: health / PM trade-off × Strength 5 / 4 / 3) and asked for an adjustment as close to 50 % as possible while keeping different stats. Added `training/auto-balance.mjs` (adjusts health only, step × 0.7 per pass, keeps the best pass, checks on other maps, prints proposed lines without applying them).
- **Numbers** (IA Normal, 400 games per pair): original characters 22–87 %; owner's draft 36.9–59.6 %; tuned 42.6–58.5 % (other maps: 43.1–59.0 %). Without damping the tuning oscillated between 13 % and 20 % worst gap.
- **Problems**: exact convergence is impossible with deterministic fights: damage values are integers, so a few HP change the number of hits needed (Thork 106 HP vs Vanessa 110 HP with 12 damage: 9 vs 10 hits → 36.6 % vs 59.5 %).
- **Still open**: owner's decision to apply the tuned health values; batch 2 (criticals, dodge) should make fine balance possible.

## 2026-10-08 — Game design batch 1: stats model and Strength

- **Done**: `createPlayer` gets `strength`, `agility`, `intelligence`, `luck` (0 by default); `PLAYER_DATA` entries may set them. `Rules.js`: `STRENGTH_BONUS` (5 %) and `weaponDamage(player, weapon)` = round(weapon damage × (1 + STR × 5 %)), used by attacks **and** by every AI (normal agent's edge / weapon / lethal checks, fight observation, movement features, neural inputs) so they reason on real damage. Balance analysis and lab: Strength column (editable, copied with the stats); other stats will be added with the batches that give them an effect. Sidebar: line "FOR · AGI · INT · CHA". Docs: architecture (data model), spec-gameplay (stats, attack formula), spec-game-design (batch 1 ✅), conventions (add a character), roadmap.
- **Numbers**: 116/116 tests (7 new: model defaults, repository stats, damage formula, attack with strength + defense, normal AI lethal check with strength, fight observation, balance effect — strength 10 vs 0: > 65 %). Balance analysis unchanged to the decimal with all stats at 0 (Xena 86.9 %, first player 56.6 %). UI check: balance screens 24/24 after a fix; full run 131/136 before the fix (long names clipped in the lab on phones).
- **Problems**: in the lab on small screens, hiding the avatar shifted every cell of the grid row (bars disappeared) — the automatic check passed, the screenshot showed it; fixed with a dedicated grid for small screens.
- **Still open**: owner's check of batch 1; batch 2 (Agility criticals, Luck dodge).

## 2026-10-08 — Game design specification draft

- **Done**: owner concluded that health and PM alone cannot balance characters, and wants to start with a game-design spec; key idea: being able to **flee a fight** with PM (possibly driven by Luck). Wrote `docs/spec-game-design.md` v0.1 (draft): goals, 6 stats (HP, STR, AGI, ARM, LCK, PM), fight actions attack / defend / flee with proposed formulas, weapon types with stat scaling, 4 classes with counters, first-player and stalemate rules, impact on the project, delivery in 7 batches, 6 open questions. Linked from AGENTS orientation and the roadmap. No code changed.
- **Numbers**: none (design work).
- **Problems**: none.
- **Update (v0.2)**: owner decided the stats — Health, Strength (weapon damage power), Agility (critical hits and tackle), Intelligence (mana for future heal / hinder spells), Luck (dodge and fleeing, against the enemy's tackle); Armour removed. Spec updated with proposed formulas (flee chance = (LCK + 2) / (LCK + enemy AGI + 4), clamped 10–90 %), classes revised (Brute, Jailer, Rogue, Duellist, Mage later), batches updated.
- **Update (v0.3)**: flee formula accepted for a first version, failure = free enemy attack, no extra cost; classes Brute, Ent (roots grab victims, ex-Jailer), Thief / Voleur (ex-Rogue), Duellist, Mage later; characters assigned at random (seed 2026); Initiative proposed for the first-player advantage (derived A or own stat B).
- **Update**: batch order (spec §10) accepted by the owner.
- **Still open**: spec §11 questions 4 (starting formulas) and 6 (initiative A/B, anti-stalemate — needed only for batch 6); go for batch 1.

## 2026-10-08 — Balance lab

- **Done**: owner chose option A (edited stats stay in the lab). Shared analysis module `src/AI/Balance.js` (step-by-step generator, `runBalance`, `playMatch`); `training/balance.mjs` now uses it; `src/AI/balance.worker.js`; page `#balance` (`BalanceView`, button "Équilibrage" on the training page): editable health / movement points per character (modified rows highlighted, results dimmed when stale), "Lancer l'analyse" / "Arrêter" with progress bar, IA Normal or champion, games per duel, summary (draws, first-player advantage, spread), win-rate bars (red / green / blue), 15 × 15 duel matrix with tooltips, portrait tabs, "Copier les stats" (PLAYER_DATA format). New colour variable `--balance-ok`. `ui-check`: 3 balance screens. Docs: D-015, architecture, AGENTS map, spec-gameplay, ui-design, development, roadmap.
- **Numbers**: refactored CLI gives exactly the previous results (Xena 86.9 %, first player 56.6 %). 109/109 tests (5 new). Balance screens 24/24 in headless Chrome; 5,250 games (50 per duel) analysed in the browser in under 4 s; with Björn set to 200 HP he rises to 80 %. Full UI check: 136/136 (8 sizes × 17 screens), exit code 0, outputs on E:.
- **Problems**: none.
- **Still open**: owner's check; rebalancing decisions; Phase 8 game design (new stats, weapon affinities).

## 2026-10-08 — Character balance analysis

- **Done**: the owner observed that health, the weapon found and movement points decide whether the AI flees, and suspected unbalanced characters. Added `training/balance.mjs` (every pair of characters, same AI on both sides, CSV matrix next to the project). No game data changed: rebalancing is a game-design decision for the owner.
- **Numbers** (400 games per pair, 42,000 games, seed 1):
  - AI `normal` (engages): Xena (300 HP / 1 PM) 86.9 %, Bolvar (150 / 2) 72.4 %; the seven 100 / 3 characters 48–50 %; Kerhs (100 / 5) and Lancelot (100 / 4) 53.4 %; Thork (100 / 2) 45.3 %; Gunnar and Brutus (75 / 4) 28 %; Indiana (70 / 5) 22.4 %. Health dominates; movement points are worth only ±4 %. Draws 2 %; the first player wins 56.6 % of decided games.
  - AI `champion` (cautious, avoids exposure): 58 % draws (two cautious AIs avoid each other until the 300-turn limit); movement points become decisive — Kerhs (5 PM) 29.1 % best, Thork (2 PM) 13.1 % and Xena (1 PM) 18.4 % worst; the first player wins 63 % of decided games.
- **Problems**: none; the analysis with the champion takes ~3 min.
- **Still open**: owner decisions on rebalancing (stats, character identities, anti-stalemate rule, first-player advantage); weapon luck not measured yet.

## 2026-10-08 — Nothing written on drive C: any more

- **Done**: the owner asked why I wrote helper scripts to `C:\Users\…\AppData\Local\Temp\bgr-scripts\` and set a rule: drive C: (the owner's most sensitive disk) must not be used. Listed and, with the owner's approval, deleted everything I had written there (`bgr-scripts` 36 KB, `boardgame-reborn` 15 MB of screenshots / models, the previous session's scratchpad 400 MB with Chrome profiles, two leftover `bgr-ui-check-*` Chrome profiles); stopped a UI check that was writing there. `tools/ui-check.mjs` (screenshots and temporary Chrome profiles) and `training/train-*.mjs` now write to `../BoardGameReborn-output/` (next to the project on E:, outside it for Live Server). No more helper scripts: project files are edited directly. Rule added to `AGENTS.md` (absolute rules); D-009, development, architecture updated.
- **Numbers**: UI check 112/112 with outputs on E:; `train-fight.mjs` writes `E:\Développement\Jason\BoardGameReborn-output\training\fight-model.json`; nothing left under `C:\…\Temp` from this project's tools.
- **Problems**: Claude Code itself stores background-command outputs under `C:\…\Temp\claude\…` — not controllable from the project.
- **Still open**: none for this point.

## 2026-10-08 — Phase 7.4a–b: neural network written by hand, imitation of the champion

- **Done**:
  - 7.4a: `src/AI/NeuralNetwork.js` (multilayer perceptron, He init, ReLU / tanh, backprop, SGD and Adam, JSON); `tests/NeuralNetwork.test.mjs` (shape, numerical gradient check for tanh and ReLU, XOR, Adam vs SGD, step averaging, JSON).
  - 7.4b: `NeuralMovePolicy.js` (159 raw inputs: 5 × 5 view + globals, visible information only; neural agent), `DefaultModels.js` (genetic champion weights, seed 1), `ImitationTrainer.js` (recording, train / test split, distillation, batch-by-batch training), `NeuralLesson.js` + lesson in the training page (error curves, network size), `training/train-imitation.mjs`; "IA Entraînée" can use a saved network; `ModelStorage` keeps one movement model (weights or network). `TrainingView`: generic chart drawing (`#plot`) for the win-rate and loss charts. `ui-check`: screen "training-neural".
  - Docs: D-014, architecture, spec-gameplay, ui-design, development, roadmap; learning notes for 7.4.
- **Numbers**: 104/104 tests (16 new). CLI (seed 1): hard labels, 500 games → 87 % train accuracy but test loss rising from epoch 2 (overfitting), 50 % wins; distillation + SGD → no overfitting but very slow (loss 1.91 → 1.84 in 8 epochs, 38 % wins); distillation + Adam, 1,500 games → 54–57 % wins from epoch 1 (teacher 70.5 %, Normal 51.5 %); 7 × 7 view → same plateau, twice as slow. Browser: ~1 s to record 800 games, ~1 s per epoch, 200-game evaluation ~0.4 s (Node). UI check: 112/112 (8 sizes × 14 screens), exit code 0.
- **Problems**: a shell command of mine contained a stray `cat` waiting on stdin and hung until the owner backgrounded it; stopped. The network cannot learn the champion's "enemy reach" reasoning from local inputs — honest ceiling of this approach.
- **Still open**:
  - Owner's check of the "Réseau de neurones" lesson.
  - 7.4c (reinforcement on top of imitation), 7.5 (generic recipe).

## 2026-10-08 — Tool outputs moved out of the project (Live Server reload loop)

- **Done**: the owner's app reloaded every second: VS Code Live Server (port 5500) reloads on any file change in the project, and a background `ui-check` run (left over from the previous session) was writing a screenshot to `tools/output/` every 2–3 s. Stopped it (and the unused Python server on port 8090). Owner chose option 1: `tools/ui-check.mjs` now writes to `<system temp>/boardgame-reborn/ui-check/` (`--out` to override) and `training/train-*.mjs` to `<system temp>/boardgame-reborn/training/`. Docs: D-009, development, architecture, AGENTS step 4.
- **Numbers**: full UI check re-run after the change: 104/104 (8 sizes × 13 screens), exit code 0, screenshots in the system temp directory; nothing written to the project folder.
- **Problems**: the interrupted run means the Phase 7.3 full UI check had not completed before this fix (training screens alone: 32/32).
- **Still open**:
  - `tools/output/` and `training/output/` may still contain old generated files (git-ignored); they can be deleted by the owner.
  - Phase 7.1–7.3 checked by the owner ("C'est good"); next step to agree: 7.4 (neural network).

## 2026-10-08 — Phase 7.3: movement learned by a genetic algorithm

- **Done**:
  - `src/AI/MoveFeatures.js` (9 features from visible information only, weighted movement agent), `src/AI/Genetic.js` (generic GA), `src/AI/MoveTrainer.js`, `training/train-move.mjs`; `Arena.gameSteps` (step-by-step game for demos).
  - Training page: lessons `FightLesson` / `MoveLesson` behind one interface, `TrainingSession` made generic; lesson selector, "générations" tile, champion weights bars, champion demo games, per-lesson save.
  - `ModelStorage.save/load(kind)`; "IA Entraînée" = evolved movement + Q-learning fights, Normal's rule for any missing model.
  - `tools/ui-check.mjs`: new screen "training-move". Docs: D-013, architecture, spec-gameplay, ui-design, development, roadmap; learning notes for 7.3.
- **Numbers**: 88/88 tests (10 new). CLI, seed 1: 47.5 % → 71.8 % against Normal in 25 generations (45,000 games, 13.3 s). Unseen games (seed 4242, 1,000 games): 65.6 % (seed 2), 66.8 % (seed 3); against random 95.1 % (Normal: 84.2 %), against easy 92.4 % (Normal: 81.3 %). Evolved movement + Q fights: 65.6 % (same as with Normal's fight rule). Browser: ~10 generations / 18,000 games in 2.5 s at "Max". Champion weights (seed 1): duel advantage +1.72, weapon gain +1.70, danger if he attacks −2.15, move bonus −1.82.
- **Problems**: a first version of a trained-mode test passed even if the model was ignored (Normal would make the same move); rewritten so only the evolved movement passes it.
- **Still open**:
  - Owner's check of the "Déplacement" lesson and of "IA Entraînée" with both models.
  - The negative weight on move bonuses is unexplained (noise or real effect?) — a good exercise.
  - Phase 7.4 (neural network) and 7.5 (generic recipe).

## 2026-10-08 — Training page labels; reliable syntax check; ui-check catches broken pages

- **Done**: owner asked why "IA Facile" showed a higher percentage than "IA Normal" on the training page: the figures are win rates **against** the chosen opponent (beating a weak opponent gives a high %), but the labels did not say so. Labels now name the opponent ("l'élève bat IA Facile", "l'IA Normal bat IA Facile (référence)").
  - While doing it, a syntax error (unescaped apostrophe) broke `TrainingView.js`, and **both safety nets missed it**: `node --check` exits 0 on ES module syntax errors with Node 22 (typeless `.js`), and `ui-check` passed the empty page. Fixed: syntax check is now `node --input-type=module --check < file` (AGENTS step 1, golden rule 9, development); `ui-check` fails on page JavaScript errors and on an empty `#app` (D-009 updated). Both verified on deliberately broken copies.
- **Numbers**: measured against each opponent (10,000 training games, seed 1, evaluation seed 777): random — Normal 82.8 %, learner 47.8 % → 85.3 %; easy — Normal 82.3 %, learner 36.3 % → 76.0 %; normal — Normal 51.5 %, learner 11.8 % → 51.5 %. Syntax check: all files pass. 78/78 tests. UI check (with the new error / empty-page checks): 96/96, exit code 0.
- **Problems**: see above (both safety-net gaps). The learner beats Normal's rule against the random opponent but stays below it against Easy (noisier fights).
- **Still open**:
  - Owner's check of the training page and the "IA Entraînée" mode.
  - Phase 7.3 (movement).

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
