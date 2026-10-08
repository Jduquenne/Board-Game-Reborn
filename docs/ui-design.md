# UI design

## Viewport constraints

- **No scroll**: every screen fits entirely in the visible viewport (`100dvh`, with `100vh` as fallback); no scrollable axis, including inside the sidebar and dialogs.
- `html`, `body` and `#app` keep `overflow: hidden`.
- **Fully responsive** (owner decision, 2026-10-08): phone portrait / landscape, tablet, desktop.
- No fixed pixel heights or font sizes for layout: sizes are fluid with `clamp()` based on `vmin` (CSS variables `--gap`, `--font-base`, `--font-small`, `--font-title`, `--font-big-btn` in `:root`).
- Checked on 2026-10-08 with headless Chrome at 360×640, 640×360, 390×844, 844×390, 768×1024, 1024×768, 1366×768 and 1920×1080 on every screen (menu, options, game, isometric, rules, quit dialog, fight, end of game, trap): no page scroll, no element outside the viewport, no scrollable or clipped area.

## Layouts

| Screen | Landscape | Portrait |
|---|---|---|
| Menu | title + buttons centred | same |
| Options | 3-column grid of `− value +` controls (2 columns under 480px wide), game mode, actions | same |
| Game | board area on the left, sidebar on the right (`clamp(180px, 30vw, 420px)`) | board area on top, sidebar below with the two player cards side by side; "Joueurs" title hidden |
| Rules dialog | one column; **two columns** when landscape and ≤ 600px high | one column |
| Fight banner | sprites, health, actions on one line | actions move to their own line under 600px wide (`.battleActions`) |

Phones in landscape (≤ 500px high) also hide the "Joueurs" title and tighten the player cards.

## Adaptive board

`GameView.#setCellSize()` computes the cell size (`--cell-size` on `#board`) from the real size of `.boardArea` (the flex area left by the sidebar):

- top view: `min((areaW − 10) / cols, (areaH − 10) / rows)`;
- isometric view: the rotated board measures `(W + H) / √2` wide and `(W + H) / 2` high, plus about 0.7 cell for the obstacle relief → `min((areaW·√2 − 20) / (cols + rows), (2·areaH − 20) / (cols + rows + 1.5))`;
- rounded down and clamped between 10px and 96px (`CELL_MIN`, `CELL_MAX`).

It runs at game start, on every resize / rotation (`ResizeObserver` on `.boardArea`, disconnected on unmount) and when switching between top and isometric views. Measured on 2026-10-08: 33px on a 360×640 phone, 72px on a 768×1024 tablet, 96px on 1920×1080.

## Visual identity

- Colours: CSS variables in `:root` (`css/style.css`) — `--primary` (#424242, background), `--secondary` (#E73535, accents), `--third` (#344973, cards / hover), `--text-light`, `--spinner-text`, `--danger`, `--bonus-border`, `--focus-ring`, `--overlay`, `--banner-gradient`, cell outline and ring colours. New colours go there, never hard-coded in a rule.
- Font: VT323 (Google Fonts, imported in `css/style.css`).
- Pixel-art button border (`.borderPixel`, `assets/border.svg`); red banner gradient for fights and traps; character sprites slightly overflow the fight banner.
- Buttons show the same highlight on hover and on keyboard focus (`:focus-visible`); disabled buttons are faded.
- Visibility is toggled with the `.hidden` class only, never with inline `style.display`.
- Board can switch between top view and an isometric view (`#board.isometric`).
- UI text is in French.

## Board and dialog cues

- Reachable cells: thin dark outline (`.cellToMove`). Reachable cells next to the enemy, where stopping starts a duel: red ring (`.fightZone`), tinted on hover, tooltip "Duel !".
- Active player: light pulsing ring on their cell (`.activePlayer`); no animation with `prefers-reduced-motion`.
- Tooltips (`title`) on characters, weapons (name and damage), bonuses and triggered traps.
- Fight banner shows both players' health (`.bannerHp`) when choosing an action and the target's health after a hit; at the end, the winner and the "Nouvelle partie" / "Quitter" buttons appear together.
- Dialogs (`.modalRules`: rules, quit confirmation) close with their button, the Escape key or a click outside; focus moves to their main button when opened.
- "Menu" during a game asks for confirmation ("Quitter la partie ?").
- Options: `−` / `+` buttons are disabled at the option's min / max.

## UI/UX audit (2026-10-08)

Inventory for [roadmap Phase 5](roadmap.md#-phase-5--uiux-overhaul). Derived from reading `css/style.css` and `src/Views/`; **not observed in a browser**. IDs (U-xx) are referenced by the roadmap, which tracks their status (Batch A: U-03, U-04 partly, U-05, U-06, U-52 fixed on 2026-10-08; Batch B: U-34, U-35, U-36, U-37, U-41, U-42, U-51, U-53 fixed on 2026-10-08; Batch C: U-01, U-02, U-10, U-20, U-21, U-30, U-31, U-32, U-33, U-40, U-50 fixed on 2026-10-08). The audit below describes the state **before** these fixes.

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

- Fixed on 2026-10-08 (Batch C): internal scroll in the game sidebar and the rules dialog; fixed `.h150px` heights (class removed).
- U-04 (rest): the board cannot be played with the keyboard. Rejected by the owner on 2026-10-08 (not wanted).
- U-07: the VT323 font is loaded from Google Fonts; offline, the browser fallback monospace font is used. Not addressed (embedding the font would add a third-party file to `assets/`, see [ATTRIBUTION](../ATTRIBUTION.md)).
- The 360×640 phone screens are dense (small text in the player cards and options); readable in headless Chrome screenshots, to be confirmed on a real phone.
