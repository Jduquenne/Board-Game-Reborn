# Development

## Prerequisites

- A modern browser (native ES modules, ES2022 private class fields).
- A local static HTTP server. Native ES modules do **not** load from `file://`, so a server is mandatory.
- Optional: Node.js for the syntax check below (verified with v22.14.0).

There is no installation step: no `package.json`, no dependencies, no bundler, no environment variables.

## Run locally

From the project root:

```bash
python3 -m http.server 8080   # or: python -m http.server 8080
```

Then open <http://localhost:8080>.

| Command | Verified during migration (2026-10-08) |
|---|---|
| `python -m http.server` | ✅ server answers 200 on `/index.html` and `/src/app.js` |
| `python3 -m http.server` | ⚠️ `python3` exists on the machine, not run |
| `npx serve .` | ⚠️ not verified (requires downloading the `serve` package) |
| In-browser manual play-through | ⚠️ not done during migration |

## Syntax check

```bash
for f in $(find src tools training tests -name "*.js" -o -name "*.mjs" | grep -v output); do node --input-type=module --check < "$f" || echo "FAIL $f"; done
```

No `FAIL` line = success. ✅ Verified 2026-10-08 with Node v22.14.0: every file passes, and a file with a deliberate syntax error is reported.

> ⚠️ Do not use `node --check file.js` on its own: the project has no `package.json`, so Node 22 guesses the module type of each `.js` file, and in that mode `--check` exits with 0 **even when an ES module has a syntax error** (found on 2026-10-08, after a broken `TrainingView.js` passed the check). Reading the file from stdin with `--input-type=module` forces ES module parsing and reports the error.

## Tests

From the project root:

```bash
node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning
```

✅ Verified 2026-10-08 with Node v22.14.0: 44 tests, all passing, ~0.1 s. Look at the final `# pass` / `# fail` lines.

- Node finds every `*.test.mjs` file automatically; to run one file: `node --test tests/FightEngine.test.mjs`.
- The plain `node --test` also works; it just prints two expected warnings (see [D-008](decisions.md#d-008--tests-with-nodes-built-in-test-runner)).
- Only `src/Engine/` logic is covered. Views (DOM) still require a manual check in the browser.
- How to write tests: [`conventions.md`](conventions.md#testing).

## UI check (responsive layout)

```bash
node tools/ui-check.mjs                                   # full run: all 8 screen sizes × 18 screens (shared CSS, global layout, index.html)
node tools/ui-check.mjs --screen rules                    # targeted run: only the screens a change touched, every size
node tools/ui-check.mjs --viewport phone --screen game    # filters (substring match on the names)
```

✅ Verified 2026-10-08 (Chrome, Node v22.14.0): 72/72 cases without issue, exit code 0; a deliberately broken copy of the CSS made it fail with exit code 1.

- Starts its own local server: no need to run `python -m http.server` first.
- Finds Chrome / Chromium / Edge in the usual install paths; otherwise set `CHROME_PATH`.
- Screen sizes: 360×640, 640×360, 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080. Screens: menu, options, game, isometric, rules, quit dialog, fight, end of game, trap.
- Fails (exit code 1) on: JavaScript error in the page, empty page (`#app` without content), page scroll, element outside the viewport, scrollable area, clipped content.
- Screenshots and `report.json` go to `../BoardGameReborn-output/ui-check/` (next to the project, path printed at the end; `--out <folder>` to change it): look at the ones related to your change. They are written **outside the project** on purpose — an auto-reloading dev server (e.g. VS Code Live Server) would otherwise reload the page at every screenshot — and **never on drive C:** (owner rule, also for the temporary Chrome profiles, created in the same folder).
- To check a new screen or dialog, add it to the `SCREENS` array in the script. Rationale: [D-009](decisions.md#d-009--automated-ui-checks-with-headless-chrome).

## AI arena

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/arena.mjs --games 1000 --seed 1
```

✅ Verified 2026-10-08: plays every pair of scripted agents (random, easy, normal) with alternated seats; same seed → same results; ~5,700 games/s on the owner's machine.

| A | B | A wins | B wins | draws |
|---|---|---|---|---|
| random | easy | 40.1 % | 59.7 % | 0.2 % |
| random | normal | 13.8 % | 86.0 % | 0.2 % |
| easy | normal | 18.9 % | 80.8 % | 0.3 % |

(1,000 games per pairing, seed 1, 2026-10-08.)

## AI training

- **In the browser**: menu → "Entraîner l'IA" (route `#training`). Training runs in a Web Worker (`src/AI/training.worker.js`), so the page needs the local HTTP server like the rest of the game. ✅ Checked 2026-10-08 in headless Chrome: ~17,500 training games in under 2 s at "Max".
- **In the terminal**:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/train-fight.mjs --games 30000 --seed 1 --opponent normal
```

✅ Verified 2026-10-08: prints the evaluation every 5 % of the games, then the learned policy; writes `../BoardGameReborn-output/training/fight-model.json` (outside the project, same reason). Result with seed 1: 11.8 % → 51.5 % wins against Normal in ~3,000 games (Normal's own fight rule: 51.5 % on the same games); 60,000 games in ~7 s.

Movement (genetic algorithm):

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/train-move.mjs --generations 25 --seed 1 --opponent normal
```

✅ Verified 2026-10-08: prints best / average fitness and the evaluation of the champion per generation, then its weights; writes `../BoardGameReborn-output/training/move-model.json`. Result with seed 1: 47.5 % → 71.8 % wins against Normal in 25 generations (45,000 games, ~13 s); on 1,000 unseen games (seed 4242) two other seeds give 65.6 % and 66.8 %.

Neural network imitating the champion:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/train-imitation.mjs --games 1500 --epochs 8 [--lr 0.003] [--hidden 32,16] [--hard]
```

✅ Verified 2026-10-08: prints training / test loss and accuracy and the win rate against Normal per epoch; writes `../BoardGameReborn-output/training/neural-move-model.json`. Result (seed 1, distillation, Adam): 30 % → 54–57 % against Normal in 8 epochs (~1 min); the teacher reaches 70.5 %. `--hard` (hard labels, no distillation) overfits: 87 % training accuracy, test loss rising.

## Character balance analysis

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/balance.mjs --games 400 --agent normal   # or --agent champion
```

Same analysis as the Balance lab page (both use `src/AI/Balance.js`). Every character plays every other one (`--games` per pair, seats alternated) with the **same AI on both sides**, so only the characters differ. Prints each character's average win rate, best / worst matchup, draws and first-player advantage; writes the full matrix to `../BoardGameReborn-output/training/balance-<agent>.csv`. ✅ Verified 2026-10-08: 42,000 games in 6 s with `normal`, ~3 min with `champion`. Sanity check: the 7 characters with identical stats (100 HP / 3 PM) all land at 48–50 % with `normal`.

Automatic health tuning (keeps each character's PM and Strength, adjusts health only):

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/auto-balance.mjs --games 400 --passes 14 [--agent normal|champion]
```

Prints the spread per pass (step size × 0.7 each pass, best pass kept), checks the result on other maps (seed + 1000) and prints proposed `PLAYER_DATA` lines — **nothing is applied**. ✅ Verified 2026-10-08 on the owner's first draft: 36.9–59.6 % → 42.6–58.5 % (check on other maps: 43.1–59.0 %). With deterministic fights, balance moves by steps (1 HP can add one hit to take), so it cannot converge exactly; randomness in fights (batch 2) should smooth it.

## Build, lint, format

None exist.

## Debugging

- Use the browser DevTools; check the Console for module loading errors (usually a wrong relative import path or missing `.js` extension).
- Navigation is hash-based: open `#menu`, `#options` or `#game` directly.
- `store.state` and `eventBus` are module singletons; they are not exposed on `window`.

## Known issues

- See "Known deviations" in [`ui-design.md`](ui-design.md#known-deviations).
- See "Honest status" in [`roadmap.md`](roadmap.md#honest-status-2026-10-08).
