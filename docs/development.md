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

## Build, lint, format, tests

None exist yet. Tests will be added (owner decision, 2026-10-08); the approach must respect the zero-dependency rule and will be recorded in [decisions](decisions.md). See [roadmap Phase 4](roadmap.md#-phase-4--automated-tests).

## Debugging

- Use the browser DevTools; check the Console for module loading errors (usually a wrong relative import path or missing `.js` extension).
- Navigation is hash-based: open `#menu`, `#options` or `#game` directly.
- `store.state` and `eventBus` are module singletons; they are not exposed on `window`.

## Known issues

- See "Known deviations" in [`ui-design.md`](ui-design.md#known-deviations).
- See "Honest status" in [`roadmap.md`](roadmap.md#honest-status-2026-10-08).
