# Tactical specification — ranged attacks, board spells, terrain, procedural maps (Phase 9)

> **Status: DRAFT v0.1 (2026-10-12) — proposal, nothing implemented.** Everything here is a proposal to be validated by the owner (questions in §9). Once validated, the rules move to [`spec-gameplay.md`](spec-gameplay.md) batch by batch, as for [`spec-game-design.md`](spec-game-design.md).

## 1. Why

Today a game is mostly decided by stats, weapon and who strikes first: the board is only a way to reach a weapon, a bonus or the enemy, and every fight is a melee duel. Measured gap between AI levels (arena, 2026-10-09): Expert beats Normal 68.7 %, Godlike beats Expert 86 % — strong AIs already win, but there are few decisions where position matters.

Owner's goal (2026-10-09): **movement and placement must have real weight**, so that decisions matter more than stats and stronger AIs can show their level.

## 2. Design goals

1. **Position matters**: where a character ends its move changes what it can do next turn and what the enemy can do to it (range, line of sight, cover).
2. **Meaningful choice every turn**: move, shoot, cast, take cover, or close in for a melee duel.
3. **Fair maps**: a generated map never favours one starting position (symmetry), never blocks a player, and is reproducible from a seed (AI training and balance lab).
4. **Readable**: ranges, line of sight and terrain effects are shown on the board before acting.
5. **Measurable**: each batch is checked in the balance lab and the arena (§8).
6. **Every AI level plays every new action** (Normal by rules, Difficile / Expert by features, Godlike by search).

## 3. Turn structure (proposal)

Today: exactly one move per turn; moving next to the enemy starts a melee duel.

Proposal: **move, then one optional action**.

1. **Move** (optional): as today, straight line, 1 to PM cells. New: the player may **stay in place** (needed to shoot from a good spot).
2. **Action** (optional), from the cell reached:
   - **Shoot** with a ranged weapon (§4);
   - **Cast a board spell** (§5);
   - **Melee**: as today, ending the move in a security zone starts the duel (the duel replaces the action);
   - **End turn**.

Alternative A (simpler, fewer AI branches): the action **replaces** the move (move *or* shoot *or* cast). Recommended: the proposal above (move then act) — it is what makes positioning tactical.

## 4. Ranged attacks (proposal)

- New weapon type **ranged** (`WEAPON_TYPE.RANGED`, label "à distance"), with a **range** (`range`, 2–4 cells).
  - Arc de Nodens becomes ranged (range 3); 2 new weapons, e.g. a crossbow (range 4, high damage) and throwing knives (range 2, light) — names and images to choose (no image yet: reuse existing ones or add free ones, see [`ATTRIBUTION.md`](../ATTRIBUTION.md)).
- **Line of sight**: straight lines only (same 4 directions as movement), blocked by obstacles and by the other player. Simple to read and to compute; diagonal shots: later.
- **Shot**: same damage formula as a melee attack (Strength, criticals, dodge, defense), but the target **does not** enter a duel: it simply takes the damage and plays its turn normally.
- **Ranged weapon in a melee duel**: hits at 50 % damage (an archer caught in melee is weak) — this is the counterplay: close in on an archer.
- Minimum range: 2 (adjacent = duel).
- No ammunition in v1.

## 5. Board spells (proposal)

Cast with mana (Intelligence, batch 8) as the turn's action. Proposal: pick **2 for v1**.

| Spell | Cost | Effect | Why |
|---|---|---|---|
| **Boule de feu** (fireball) | 30 | range 3, line of sight; 10 + 2 × INT damage to the target cell and the 4 adjacent cells (the caster too, if inside) | ranged option for Mages |
| **Téléportation** | 25 | move to any free floor cell within 4 cells (Manhattan), no line of sight needed | escape / ambush |
| **Piège posé** (lay trap) | 20 | place a hidden trap on an adjacent empty cell (hidden from the enemy, like random traps) | zone control |
| **Ralentissement** (slow) | 20 | range 3; the enemy has −2 PM on its next move (minimum 1) | stops a runner / a Thief |

Recommended for v1: **Boule de feu** and **Ralentissement** (easiest to read and for AIs; Piège posé creates hidden information that only the caster knows, Téléportation makes maps less important).

## 6. Terrain (proposal)

New decor values next to `floor` and `obstacle`, using the unused images `grass.png`, `wood.png`, `rock.jpg`:

| Terrain | Image | Effect |
|---|---|---|
| **Couvert** (cover: bush, crates) | `grass.png` or `wood.png` | a character standing on it takes −50 % damage from **shots and spells** (not melee); does not block line of sight |
| **Hauteur** (high ground) | `rock.jpg` | a character shooting from it has +1 range and +10 % shot damage |
| **Boue** (mud, slow) | to find | entering it stops the move (the cell is reachable, cells behind it are not) |

Effects are shown in the cell tooltip and in the rules modal.

## 7. Procedural maps (proposal)

New pure module `src/Engine/MapGenerator.js` (no DOM), seeded: **same seed + same settings → same map**.

- **Style**: "Arène" (open areas, scattered cover) and "Donjon" (small rooms joined by corridors), chosen in Options; "Classique" (current random placement) kept.
- **Point symmetry** (the map turned 180° is identical): both players start at mirrored positions, items are placed in mirrored pairs → no starting position is better. Odd counts (e.g. 3 weapons): the extra item goes on the centre line.
- **Checks** at generation (regenerate with the next seed if they fail): every floor cell is connected (flood fill), both players can move on turn 1, minimum distance between the starting positions.
- **Seed**: random by default; shown in Options ("Graine") so a map can be replayed; the arena and the balance lab use fixed seeds.
- Board size: grids stay 7–12 × 7–12 (viewport rule). Question: is 12 × 12 enough for ranged combat (§9)?

## 8. AIs and measurement

- **Normal** (rules): shoot if the enemy is in range and line of sight; otherwise, prefer a cell from which it can shoot next turn without being in the enemy's line of sight; spells: fireball when in range, slow a runner; keeps today's melee rules.
- **Difficile / Expert** (features + trained weights): new features (can shoot from the cell, in the enemy's line of sight, cover, high ground, distance to the best shooting cell); retrained with `train-expert.mjs`. The shipped Difficile champion and the neural network (7.4b) do not know the new actions: they fall back to Normal's rules for actions until retrained.
- **Godlike** (search): searches over (cell, action) pairs instead of cells; Expert plays the simulations. Thinking time to watch (more branches).
- **Q-learning fight table**: unchanged (melee duel only).
- **Balance lab / arena**: measure per batch: character and class win rates, first-player advantage, draws, and **gap between AI levels**.

**Done when** (proposal): the new actions are playable by humans and every AI level; characters stay within 45–55 %, first player ≤ 55 %; and the skill gap widens — **Expert beats Normal ≥ 75 %** (68.7 % today) on generated maps.

## 9. Open questions for the owner

1. Turn structure: **move then act** (recommended) or action **instead of** moving (simpler)?
2. Ranged attacks: straight-line line of sight only (recommended for v1), ranged weapon at 50 % in melee, no ammunition — OK? Which new ranged weapons (names)?
3. Board spells: which 2 for v1 (recommended: Boule de feu + Ralentissement)? Are spells still allowed in melee duels (Soin, Entrave) — yes, unchanged?
4. Terrain: cover, high ground, mud — all three, or start with cover only?
5. Maps: styles "Arène" and "Donjon" + "Classique" kept? Symmetry mandatory? Seed shown in Options?
6. Board size: keep 12 × 12 as the maximum, or try up to 14 × 14 (to check against the no-scroll rule on phones)?
7. Batch order (§10).

## 10. Delivery in batches (proposal)

Each batch: rules in `Rules.js` with tests, UI, Normal AI and `GameEnv` actions (so that every AI keeps working), arena + balance lab measurement, owner's check in the browser.

1. **Turn structure + ranged weapons**: optional move ("Rester sur place"), action phase, `range`, line of sight, shot, 50 % in melee; range and targets shown on the board; Normal AI shoots.
2. **Procedural maps**: `MapGenerator.js`, styles, symmetry, seed in Options, checks; arena / balance lab on generated maps.
3. **Terrain**: cover, high ground, mud (generated by the map styles).
4. **Board spells**: the 2 chosen spells; Normal AI casts them.
5. **AIs**: Expert features and retraining, Godlike searches over actions, Difficile retrained; final measurement against the "done when".
