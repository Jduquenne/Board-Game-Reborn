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
for f in $(find src -name "*.js"); do node --check "$f"; done
```

✅ Verified 2026-10-08: all 26 files pass with Node v22.14.0. Silent output = success.

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
node tools/ui-check.mjs                                   # all 8 screen sizes × 9 screens (~2 min)
node tools/ui-check.mjs --viewport phone --screen game    # filters (substring match on the names)
```

✅ Verified 2026-10-08 (Chrome, Node v22.14.0): 72/72 cases without issue, exit code 0; a deliberately broken copy of the CSS made it fail with exit code 1.

- Starts its own local server: no need to run `python -m http.server` first.
- Finds Chrome / Chromium / Edge in the usual install paths; otherwise set `CHROME_PATH`.
- Screen sizes: 360×640, 640×360, 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080. Screens: menu, options, game, isometric, rules, quit dialog, fight, end of game, trap.
- Fails (exit code 1) on: page scroll, element outside the viewport, scrollable area, clipped content.
- Screenshots and `report.json` go to `tools/output/` (git-ignored): look at the ones related to your change.
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

## Build, lint, format

None exist.

## Debugging

- Use the browser DevTools; check the Console for module loading errors (usually a wrong relative import path or missing `.js` extension).
- Navigation is hash-based: open `#menu`, `#options` or `#game` directly.
- `store.state` and `eventBus` are module singletons; they are not exposed on `window`.

## Known issues

- See "Known deviations" in [`ui-design.md`](ui-design.md#known-deviations).
- See "Honest status" in [`roadmap.md`](roadmap.md#honest-status-2026-10-08).
