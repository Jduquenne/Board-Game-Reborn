# Tactical specification — Dofus Retro-like fights (Phase 9)

> **Status: DRAFT v0.2 (2026-10-12) — batches 1 to 4 implemented (2026-10-12), the rest is a proposal.** Batches 1–4 used the recommended answers to §11 (6 PA / 3 PM for every class, existing portraits as placeholders, SVG rendering, no turn timer, the spells of §8, a Coup de poing for every class); the owner can still change them. The implemented rules are in §13. Decided by the owner: Dofus Retro gameplay (PA / PM spent freely in any order during a turn, spells at range, in melee and semi-melee, line of sight), its 12 classes (4 first), an isometric board of the size of [`assets/image.png`](../assets/image.png), a **new mode next to the current game** ([D-017](decisions.md#d-017--tactical-mode-built-next-to-the-current-game)), no pickups in fights. Numbers and formulas marked "proposal" are still to be validated (open questions in §11). Once validated, rules move to a gameplay specification batch by batch.
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
2. ✅ **Spells** (2026-10-12): spell model (cost, range, line of sight, in line, effects: damage, push, pull, heal, PA / PM changes, cooldown), range and line-of-sight display, the 4 classes, class choice, placement phase, initiative. See §13.
3. ✅ **Stats and tackle** (2026-10-12): elements, criticals, tackle / dodge, sudden death; also push damage. See §13.
4. ✅ **AI Normal** for the tactical mode + simulator + arena (2026-10-12). See §13.
5. **Random maps** (seeded) + balance lab for classes.
6. Later: stronger AIs, the 8 other classes, Range stat, turn timer, visual style.

**Done when** (v1 = batches 1–4): a full fight can be played on the isometric board with the 4 classes, two humans or against the AI, on every screen size without scrolling.

## 13. As built (batches 1–3, 2026-10-12)

Rules implemented in `src/Engine/Tactical/` (tested in `tests/Tactical*.test.mjs`); values are first drafts, to tune in batch 3–5.

**Fight flow**

1. **Class choice** (window "Choix des classes"): each player picks Iop, Crâ, Eniripsa or Sacrieur (same class allowed: names get "bleu" / "rouge").
2. **Placement**: each character starts on a random placement cell of its colour (shown in blue / red); a click on a free cell of a colour moves that colour's character there; "Prêt" ends the placement.
3. **Initiative**: the higher class initiative plays first (Crâ 110, Eniripsa 105, Iop 100, Sacrieur 90; tie → coin flip).
4. **Turn**: 6 PA and 3 PM, spent in any order: a click on a reachable cell (light green; path under the pointer in dark green) moves by the shortest path, 1 PM per cell; a spell button then a target cell casts the spell. "Fin du tour" passes; PA and PM are refilled at the start of the player's turn.
5. **End**: a character at 0 HP loses ("X remporte le combat !", "Rejouer" goes back to the class choice).

**Line of sight**: segment between cell centres on the square grid; blocked by blocks and characters (start and end cells excluded), not by holes; a segment through an exact corner touches neither side cell. Cells in range with line of sight are shown in blue, without in grey; the target (and its area) under the pointer in dark blue.

**Spell rules**: a spell needs its PA, fewer casts this turn than `perTurn`, and no cooldown left; the target cell must be in range (and in line / in sight if required) and match the spell's target (`enemy`, `self`, `free` cell, any `cell`). Push / pull move the target cell by cell along the main axis between caster and target, stopping at a block, a hole, the border or a character; a **blocked push** deals 6 damage per cell not travelled (not for pulls). PA changes apply at the start of the target's next turn. Cooldown N: castable again N turns of the caster later.

| Class | HP | Spell | PA | Range | Effect |
|---|---|---|---|---|---|
| Iop | 165 | Pression | 3 | 1 | 13–17 damage, 2 per turn |
| | | Bond | 4 | 2–5, no line of sight | teleport to a free cell, 1 per turn, cooldown 2 |
| | | Intimidation | 2 | 1 | 4–6 damage + push 3, 1 per turn |
| | | Colère de Iop | 6 | 1 | 34–42 damage, cooldown 3 |
| Crâ | 135 | Flèche magique | 3 | 2–8 | 8–11 damage, 2 per turn |
| | | Flèche de recul | 3 | 1–6, in line | 5–7 damage + push 3, 1 per turn |
| | | Flèche glacée | 3 | 2–6 | 4–6 damage, −2 PA next turn, 1 per turn |
| | | Flèche explosive | 4 | 3–7 | 9–12 damage in a radius of 1 (any floor cell), 1 per turn |
| Eniripsa | 140 | Mot interdit | 3 | 1–6 | 8–11 damage, 2 per turn |
| | | Mot soignant | 3 | self | heal 14–18, 1 per turn |
| | | Mot de frayeur | 2 | 1–3, in line | push 3, 1 per turn |
| | | Mot stimulant | 2 | self | +2 PA next turn, cooldown 3 |
| Sacrieur | 180 | Attirance | 3 | 2–6, in line | pull 5 (next to the caster), 1 per turn |
| | | Transposition | 2 | 1–5, no line of sight | swap places, 1 per turn, cooldown 2 |
| | | Absorption | 4 | 1–2 | 11–14 damage, heals half the damage dealt |
| | | Châtiment | 2 | self | 3 turns: +10 % damage per hit taken, cooldown 4 |
| all | | Coup de poing | 3 | 1 | 6–9 damage, 2 per turn |

Flèche magique, Flèche de recul, Flèche glacée, Flèche explosive and Mot interdit are marked "range modifiable" for the future Range stat (no effect yet). Spell details are in each button's tooltip.

**Stats and elements** (batch 3): every class has Force, Intelligence, Chance and Agilité (Iop 40 / 0 / 0 / 10, Crâ 0 / 15 / 15 / 40, Eniripsa 0 / 40 / 0 / 20, Sacrieur 30 / 0 / 0 / 25), shown on the fighter cards. Health was raised by 50 % at the same time (fights would otherwise end in 2–3 turns).

- **Damage** = (roll + critical bonus) × (1 + element stat / 100) × Châtiment, rounded. Elements: neutral and earth → Force, fire → Intelligence, water → Chance, air → Agilité. Spell elements: Pression, Colère de Iop, Absorption earth; Intimidation, Coup de poing neutral; Flèche magique, Flèche de recul air; Flèche glacée water; Flèche explosive, Mot interdit fire. Damage ranges in the table above are before the stat.
- **Heals** = (roll + critical bonus) × (1 + Intelligence / 100), up to the starting health.
- **Critical hits**: each damage or heal spell has a rate of 1 in N (40 or 50) and a flat bonus (+2 to +10); Agilité lowers N: N × 50 / (50 + Agilité), at least 2 (Crâ: 1 in 22 instead of 40). One draw per cast; "Coup critique !" in the log.
- **Tackle**: each time a move leaves a cell next to the enemy, a dodge roll: chance = (Agilité + 25) / (Agilité + enemy Agilité + 50) (Crâ leaving the Iop 65 %, Iop leaving the Crâ 35 %). Failure: the fighter stops on that cell and loses all its remaining PM (it can still cast). A path that leaves contact is shown in orange, with the dodge chance in the log while the pointer is on it.
- **Sudden death**: from turn 30 (15 turns each), the player starting a turn loses 10 HP, +5 every 10 turns; it can end the fight.

**AI** (batch 4, `src/AI/Tactical/`): in the class choice window, each player is "Humain" or "IA Normal" (default: player 2 is the AI; two AIs can play each other). The AI places itself, then plays one action every 0.65 s (`TacticalAIEngine`); the board highlights and spell bar are hidden during its turn.

- **Normal**: for each position it can reach this turn (stay, walk, Bond), it computes the best combination of spells castable from there with its PA (expected damage, useful heals, PA removed from the enemy; pushing spells last), plus a placement score (preferred distance to the enemy: Iop and Sacrieur 1, Eniripsa 4, Crâ 6); the tackle risk weights the value of a move. It goes to the best position, casts the planned spells, uses leftover PA on support spells (Châtiment, Mot de frayeur, Attirance, Mot stimulant), then repositions with its remaining PM and ends the turn.
- **Random** (reference): random legal action, ends the turn with 15 % chance at each decision.
- **Arena** (`training/tactical-arena.mjs`, 2026-10-12, seed 1): Normal beats random in 100 % of fights. Normal against Normal, 40 fights per ordered pair: Iop 100 %, Eniripsa 66.7 %, Sacrieur 33.3 %, Crâ 1.3 % — a strict ranking Iop > Eniripsa > Sacrieur > Crâ (each pair 96–100 % one way). First player 43.6 %, average 27.8 turns, 43.8 % of fights reach sudden death. The ranking is mostly balance (damage per turn, health, mobility; Absorption leaves 2 PA unused); the same deterministic AI on both sides turns small edges into near-100 % results.
