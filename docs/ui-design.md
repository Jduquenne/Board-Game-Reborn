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

- Colours: CSS variables in `:root` (`css/style.css`) — `--primary` (#424242, background), `--secondary` (#E73535, accents), `--third` (#344973, cards / hover), `--text-light`, `--spinner-text`, `--danger`, `--bonus-border`, `--focus-ring`, `--overlay`, `--banner-gradient`. New colours go there, never hard-coded in a rule (cell outlines `white` / `black` / `blue` / `gray` still are, to be revisited in Batch B).
- Buttons show the same highlight on hover and on keyboard focus (`:focus-visible`).
- Visibility is toggled with the `.hidden` class only, never with inline `style.display`.
- Font: VT323 (Google Fonts, imported in `css/style.css`).
- Board can switch between top view and an isometric view (`#board.isometric`).
- UI text is in French.

## UI/UX audit (2026-10-08)

Inventory for [roadmap Phase 5](roadmap.md#-phase-5--uiux-overhaul). Derived from reading `css/style.css` and `src/Views/`; **not observed in a browser**. IDs (U-xx) are referenced by the roadmap, which tracks their status (Batch A: U-03, U-04 partly, U-05, U-06, U-52 fixed on 2026-10-08).

### Global

- U-01 No media query anywhere; sizes are fixed pixels (`body` 24px, `.fatFont` 50px, sidebar 400px). Only the Options view adapts (ad-hoc `clamp()` overrides).
- U-02 `100vh` is used for full-screen layouts; on mobile browsers the address bar makes `100vh` taller than the visible area (`100dvh` exists for this).
- U-03 Only 3 colour variables; other colours are hard-coded and repeated (`#dddddd` ×14, `red`, `yellow`, `#234959`, banner gradients).
- U-04 Accessibility: `.btn` removes the focus outline with no replacement; board cells are clickable `div`s (no keyboard play); the rules close button is a `<span>X</span>`; banner images have empty `alt`.
- U-05 Spelling in UI texts: "Régles" (×2), "Paramétres", "Dégats" — expected "Règles", "Paramètres", "Dégâts".
- U-06 Inline styles in views (`style="display:flex"` in `GameView`, `style.display` toggles for the isometric buttons and the trap modal) alongside the `.hidden` class.
- U-07 The VT323 font is loaded from Google Fonts at runtime; offline, the game falls back to the default monospace font.

### Menu (`MenuView`)

- U-10 Title height fixed by `.h150px` and `.fatFont` (50px), no adaptation to small screens.
- U-11 The main button says "Lancer le combat" (same label as in Options) — it starts a game with the current settings.

### Options (`OptionsView`)

- U-20 Fixed 4-column grid (`.nb-spinner-0` … `-5` with hard-coded grid areas): cramped on narrow screens, hard to extend (adding an option needs a new CSS class).
- U-21 Value shown in a disabled text `<input>` between "+" (above) and "−" (below); no min/max feedback when a limit is reached.

### Game screen (`GameView`, `BoardView`, `PlayersSidebar`)

- U-30 Board and sidebar side by side with `flex-shrink: 0`; the sidebar needs ~440px, so on narrow / portrait screens the board shrinks to the 10px minimum cell size and the page can overflow horizontally.
- U-31 Sidebar scrolls internally (`#menu { overflow-y: auto }`): two 200px player cards + title + buttons need ~650px of height. *(Phase 3 bug.)*
- U-32 `--cell-size` is computed once at start; resizing or rotating the device does not resize the board.
- U-33 Isometric view: the rotated board is wider than the computed size and gets `margin-right: 10vw`; it can leave the viewport.
- U-34 Cells that start a fight (`isSecurityZone`) look exactly like other reachable cells; the player cannot see that a move triggers a duel.
- U-35 Whose turn it is is only shown by the highlighted card in the sidebar; nothing on the board marks the active player.
- U-36 Weapons spin on hover (`@keyframes spin`), which can be mistaken for an interaction cue.
- U-37 The "Menu" button leaves the game immediately, without confirmation (the game is lost).

### Rules modal

- U-40 `margin: 15% auto; max-width: 50%` → narrow and pushed down on small screens; scrolls internally (`overflow: auto`). *(Phase 3 bug.)*
- U-41 Incomplete rules: no mention of movement points / straight-line moves, traps, defense, AI modes.
- U-42 Closes only with the "X" (no Escape key, no click outside).

### Fight and trap banners (`BattleBanner`, `TrapBanner`)

- U-50 Banner is 100px high with 190px character images, fixed at `top: 45%`; long texts are not wrapped for narrow screens.
- U-51 Health is not shown in the banner during a fight (only in the dimmed sidebar behind the overlay).
- U-52 Battle and trap modals/banners duplicate the same CSS (`.battleModal` = `.trapModal`, `.battleBanner` = `.trapBanner`).
- U-53 End of game: winner message, then the "Nouvelle partie" / "Quitter" choice appears automatically after 1.5 s.

## Known deviations

Found during the migration on 2026-10-08, not yet checked in a browser:

- **To fix** (owner decision, 2026-10-08): `#menu` (game sidebar) has `overflow-y: auto` and `.modalRules` has `overflow: auto`, so they can scroll internally. Not an accepted exception. Tracked in [roadmap Phase 3](roadmap.md#-phase-3--fix-known-bugs).
- `.h150px` (fixed 150px height) is used in `MenuView`; only `.options-view .h150px` is clamped. Deferred to the site-wide UI/UX overhaul ([roadmap Phase 5](roadmap.md#-phase-5--uiux-overhaul)).
