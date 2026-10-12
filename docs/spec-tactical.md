# Tactical specification — Dofus Retro-like fights (Phase 9)

> **Status: DRAFT v0.2 (2026-10-12) — batch 1 implemented (2026-10-12), the rest is a proposal.** Batch 1 used the recommended answers to §11 (6 PA / 3 PM, existing portraits as placeholders, SVG rendering, no turn timer); still open for the next batches. Decided by the owner: Dofus Retro gameplay (PA / PM spent freely in any order during a turn, spells at range, in melee and semi-melee, line of sight), its 12 classes (4 first), an isometric board of the size of [`assets/image.png`](../assets/image.png), a **new mode next to the current game** ([D-017](decisions.md#d-017--tactical-mode-built-next-to-the-current-game)), no pickups in fights. Numbers and formulas marked "proposal" are still to be validated (open questions in §11). Once validated, rules move to a gameplay specification batch by batch.
>
> v0.1 (same day) proposed ranged weapons and terrain on top of the current game; the owner chose a deeper change instead.
>
> **Names**: class and spell names are those of Dofus Retro (Ankama), used as a reference for this personal learning project. If the game is ever published, they must be renamed.

## 1. Why

Today a game is mostly decided by stats, weapon and who strikes first; the board is only a way to reach a weapon or the enemy. Owner's goal (2026-10-09, refined 2026-10-12): **Dofus Retro's tactical fights** — every point of action and movement is a decision, position and line of sight matter, and stronger AIs can show their level.

## 2. Design goals

1. **Every turn is a puzzle**: spend 6 PA and 3 PM in the best order (move, hit, move away).
2. **Position matters**: range, line of sight, melee vs distance, tackle.
3. **Classes play differently**: melee, distance, heal, semi-melee.
4. **Readable**: movement paths, spell ranges and blocked line of sight are shown before acting, as in Dofus.
5. **Measurable**: balance lab and arena for classes (§9).
6. **Fits the viewport** without scrolling, on every screen size ([ui-design](ui-design.md)).

## 3. Board

Same size and look as `assets/image.png` (a standard Dofus Retro map):

- **15 cells wide × 17 rows**, rows staggered (17 rows of 15 + 16 rows of 14 = **479 cells**), drawn as isometric diamonds.
- **Border** cells (black in the image): not playable.
- **Blocks** (raised brown tiles): block movement **and** line of sight.
- **Holes** (black cells inside): block movement, **not** line of sight.
- **Placement cells**: blue (player 1) and red (player 2), chosen before the fight.
- Style: current colours for now (owner: visual style later).

Engine model (proposal): the staggered map is a square grid turned 45°. The engine stores cells with square coordinates `(x, y)`; the 4 neighbours of a cell are the 4 diagonal neighbours on screen. Distances are Manhattan distances in `(x, y)` (as in Dofus), so pathfinding, ranges and line of sight stay simple; only the view converts `(x, y)` to screen positions.

**Maps**: batch 1 reproduces the map of `image.png` as a fixed map. Later: random maps in the current style (random blocks and holes, seeded, every cell connected, mirrored placement cells).

## 4. Fight flow

1. **Placement**: each player chooses a starting cell among their colour (AI: chosen by its rule); "Prêt" starts the fight.
2. **Turn order**: by **Initiative** (higher plays first).
3. **Turn**: the player has **6 PA** and **3 PM** (base values per class, proposal), spent in **any order**:
   - **Move**: click a reachable cell; the path (shortest, through free cells) costs 1 PM per cell. Several moves per turn are allowed while PM remain.
   - **Cast a spell**: select a spell, then a target cell in range and (if required) in line of sight; costs its PA.
   - **End turn** ("Fin du tour"). PA and PM are refilled at the start of the next turn.
   - Turn timer: none in v1 (proposal: optional later, 30 s as in Dofus).
4. **End**: the fight ends when a character reaches 0 HP. Anti-stalemate: sudden death kept (proposal).

## 5. Line of sight and range

- A spell has a **range** `min–max` (Dofus "PO"), e.g. 1–1 (melee), 1–3 (semi-melee), 2–8 (distance).
- Flags per spell (as in Dofus): **line of sight required**, **cast in line only** (same row / column in `(x, y)`), **range modifiable** (for the future Range stat — owner's wish).
- **Line of sight**: straight line between the centres of the two cells; blocked if it crosses a block or a character (holes do not block). Exact cell-crossing rule: proposal, tested on known cases.
- UI: selecting a spell shows cells in range in blue, cells in range but without line of sight in a lighter colour; hovering a reachable cell shows the movement path in green.

## 6. Stats (proposal, Dofus Retro inspired)

| Stat | Effect |
|---|---|
| Vitalité → HP | health |
| PA / PM | action / movement points per turn |
| Force | earth damage +1 % per point |
| Intelligence | fire damage +1 % per point, heals +1 % per point |
| Chance | water damage +1 % per point |
| Agilité | air damage +1 % per point; dodge / tackle (§7) |
| Initiative | turn order |
| Portée (PO) | **later** (owner): + range on spells with modifiable range |

Spell damage = roll between min and max × (1 + element stat / 100), rounded. Criticals: per-spell chance (e.g. 1/50) with higher damage (proposal). Resistances: later.

Current stats (Strength / Agility / Intelligence / Luck, scale 0–10) and the 15 characters stay in the current game; the tactical mode has its own data.

## 7. Tackle and dodge (proposal)

Leaving a cell next to an enemy costs a dodge roll based on both Agilities; on a failure, the mover loses part or all of its remaining PM. Exact formula: proposal at batch 3, checked in the balance lab.

## 8. Classes (4 first, 12 later)

Each class: HP, PA, PM, main element, and 4–5 spells (Dofus Retro inspired; values to tune). Proposal for the first 4:

| Class | Role | Spells (proposal) |
|---|---|---|
| **Iop** | melee | Pression (melee, earth), Bond (jump to a free cell, range 1–5), Intimidation (push back 1 cell), Colère de Iop (big melee hit, once every 3 turns) |
| **Crâ** | distance | Flèche magique (range 2–8, air), Flèche de recul (push back 2), Flèche glacée (−PA to the target), Flèche explosive (small area) |
| **Eniripsa** | heal / support | Mot interdit (range 1–6, fire), Mot soignant (heal self), Mot de frayeur (push back), Mot stimulant (+PA next turn) |
| **Sacrieur** | semi-melee / bruiser | Attirance (pull the enemy, in line), Transposition (swap places), Absorption (damage + heal), Châtiment (gets stronger when hit) |

The other 8 (Féca, Osamodas, Enutrof, Sram, Xélor, Écaflip, Sadida, Pandawa) come once the first 4 are balanced. Some need things that do not exist yet (summons, glyphs, traps, teams).

Class choice: a class selection screen before the fight (the existing portraits as placeholders until class images exist — to decide, §11).

## 9. AI

The current AIs (Normal, Difficile, Expert, Godlike, trained) belong to the current game and keep working there. The tactical mode gets its own:

1. A pure simulator (same idea as `GameEnv`, D-010) for the tactical rules.
2. **Normal** (rules): place, walk to the best cell to cast the most damaging spell(s) with its PA, then move away with remaining PM if it is a distance class.
3. Later: Godlike-style search (sequences of actions in a turn), then trained AIs — a turn is a sequence of actions, which is a new learning problem (good material for the learning notes).

Balance lab: class against class win rates, first-player advantage.

## 10. Rendering (proposal, decision to record when validated)

**SVG** board: one polygon per cell (exact diamond hit-testing, no maths for clicks), the `viewBox` scales the whole map to the available space (no-scroll rule), blocks drawn as raised tiles (top + two faces, as in the image), characters as upright images on their cell, drawn from back to front. No dependency.

Alternatives: DOM elements with `clip-path` diamonds (heavier layout); Canvas (fast, but hit-testing, tooltips and the UI check need more work).

Phones: 479 cells in portrait give ~23 px wide cells — landscape will be recommended, portrait must still fit without scrolling.

## 11. Open questions for the owner

1. PA / PM: 6 / 3 for every class (Dofus base), or different per class?
2. Are the 4 first classes Iop, Crâ, Eniripsa, Sacrieur OK? Spells in §8 OK as a start?
3. Images for classes: existing portraits as placeholders, or simple coloured tokens until we have class images?
4. Weapons: a basic melee attack for every class ("Coup de poing", 3 PA, range 1), or spells only?
5. Rendering in SVG (§10)?
6. Turn timer: none in v1?

## 12. Delivery in batches (proposal)

Each batch: pure rules with tests, UI checked with `tools/ui-check.mjs` (new screen) and in the browser by the owner.

1. ✅ **Isometric board** (2026-10-12): new route / screen "Combat tactique" (menu), map of `image.png` in SVG, coordinates, pathfinding, PA / PM turn, move several times, "Fin du tour", 2 humans, one test melee attack. Fits the viewport. As built: test attack "Coup de poing" (3 PA, range 1, 8–12 damage, only on an enemy: a click on an empty cell is refused); two random characters of the current game (with their health) on a random placement cell of their colour; player 1 starts; reachable cells in light green, path under the pointer in dark green, punch range in blue; no line of sight yet (range 1 only).
2. **Spells**: spell model (cost, range, line of sight, in line, effects: damage, push, pull, heal, PA / PM changes, cooldown), range and line-of-sight display, the 4 classes, class choice, placement phase, initiative.
3. **Stats and tackle**: elements, criticals, tackle / dodge, sudden death.
4. **AI Normal** for the tactical mode + simulator + arena.
5. **Random maps** (seeded) + balance lab for classes.
6. Later: stronger AIs, the 8 other classes, Range stat, turn timer, visual style.

**Done when** (v1 = batches 1–4): a full fight can be played on the isometric board with the 4 classes, two humans or against the AI, on every screen size without scrolling.
