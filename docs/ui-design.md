# UI design

## Viewport constraints

- **No scroll**: the game must fit entirely within `100vw × 100vh`; no scrollable axis.
- `html`, `body` and `#app` must keep `overflow: hidden` (currently set in `css/style.css`).
- **Responsive**: every view adapts to the screen size without overflow.
- Fixed heights (`.h150px`, `calc(...)`) are forbidden if they cause the viewport to overflow.

## Adaptive board

The cell size (`--cell-size`) is computed dynamically by `GameView.#setCellSize()` when the game starts so the board always fits on screen:

- available width = `window.innerWidth` − sidebar width − 40px margins − 10px board border;
- available height = `window.innerHeight` − 10px;
- size = `floor(min(availW / cols, availH / rows))`, clamped between 10px and 60px;
- applied as a CSS custom property on `#board` (CSS fallback: `60px`).

The size is not recomputed on window resize.

## Visual identity

- Colours (CSS variables in `:root`): `--primary: #424242`, `--secondary: #E73535`, `--third: #344973`.
- Font: VT323 (Google Fonts, imported in `css/style.css`).
- Board can switch between top view and an isometric view (`#board.isometric`).
- UI text is in French.

## Known deviations

Found during the migration on 2026-10-08, not yet checked in a browser:

- **To fix** (owner decision, 2026-10-08): `#menu` (game sidebar) has `overflow-y: auto` and `.modalRules` has `overflow: auto`, so they can scroll internally. Not an accepted exception. Tracked in [roadmap Phase 3](roadmap.md#-phase-3--fix-known-bugs).
- `.h150px` (fixed 150px height) is used in `MenuView`; only `.options-view .h150px` is clamped. Deferred to the site-wide UI/UX overhaul ([roadmap Phase 5](roadmap.md#-phase-5--uiux-overhaul)).
