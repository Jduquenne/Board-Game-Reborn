# Gameplay specification

> Derived from code on 2026-10-08 (`Rules.js`, `MovementSystem.js`, `ScriptedAgents.js`, repositories, `OptionsView.js`). This describes current behaviour, not a target. Changes to the rules must update this file.

BoardGame Reborn is a turn-based, two-player duel on a grid. Players move, pick up weapons and bonuses, avoid traps, and fight when they meet. The last player standing wins.

## Setup

1. A `rows × cols` grid of floor cells is created.
2. Items are placed on random empty floor cells, in this order: obstacles, bonuses, traps, weapons, then the 2 players.
3. Weapons, bonuses and traps are drawn from a shuffled repository list (cycling if more are requested than exist).
4. The 2 characters are drawn at random from `PLAYER_DATA`. Each starts with the default weapon "Épée de boisaille" (10 damage).
5. If an AI mode is selected, the player at index 1 is the AI.
6. The character with the higher **initiative** starts (batch 6): initiative = Agility + Luck + 2 × PM, computed at game start (`initiative`, `firstPlayerIndex` in `Rules.js`); on a tie, a coin flip. A banner says who starts ("X a l'initiative (19 contre 5) et commence."); the sidebar shows "PM : 5 · Initiative 19". The AI can start.

## Configuration

| Option | Min | Max | Default |
|---|---|---|---|
| Board height (`rows`) | 7 | 12 | 10 |
| Board width (`cols`) | 7 | 12 | 10 |
| Obstacles | 7 | 20 | 10 |
| Weapons | 1 | 5 | 3 |
| Bonuses | 1 | 5 | 3 |
| Traps | 1 | 5 | 3 |
| Game mode (`aiMode`) | — | — | `none` (2 players); also `easy`, `normal` |

## Turn and movement

- The active player moves in a straight line (up, down, left, right) by 1 to `maxMove` cells.
- Movement stops at the board edge, an obstacle or a player.
- Exactly one move per turn; then the turn passes to the other player.
- A player with no reachable cell (surrounded by obstacles, the board edge or the other player) automatically skips their turn, with a message ("<nom> est bloqué et passe son tour."); this also applies to the first player at the start of a game. If both players are blocked the game cannot continue (extremely rare, not handled).
- **Sudden death** (batch 6, anti-stalemate): every turn passed counts (`state.turn`, both players). From turn 80 (40 each), the player starting their turn loses 5 HP, +5 every 20 turns (turn 100: 10, turn 120: 15…), with a banner "Mort subite ! X perd N points de vie." At 0 HP that player loses the game (event `game:over`, victory screen "X remporte la partie !"). Fight rounds do not count as turns.
- "Security zones" are the empty floor cells adjacent to the waiting player. Moving onto one starts a fight instead of ending the turn.

## Pickups and traps (on the destination cell)

- **Trap** (not yet triggered): −20 health (minimum 0); the trap becomes triggered and visible.
- **Weapon**: swapped with the player's current weapon (the old weapon stays on the cell).
- **Bonus**: `life` adds `amount` to health (no cap at `maxHealth`); `move` adds `amount` to `maxMove`. The bonus is removed.

## Fight

1. The player who moved into the security zone attacks first.
2. Each round, the attacker chooses **Attack**, **Defend**, **Flee** or a **spell**:
   - **Attack**, resolved in this order (`applyAttack` in `Rules.js`):
     1. **dodge**: the target dodges with a chance of Luck × 3 % (max 35 %) → 0 damage;
     2. otherwise **critical hit**: chance of the attacker's Agility × 3 % (max 40 %) → damage × 2 (× 1.5 until 2026-10-09); a **light** weapon adds +10 % and raises the cap to 50 %;
     3. damage = weapon damage × (1 + Strength × 5 %) — 7 % per point with a **heavy** weapon — rounded (`weaponDamage`), × 2 on a critical, halved (rounded down) if the target is defending.
     Defense flags of both players reset. No random draw is made when both chances are 0. The fight banner shows "Coup critique !" or "… esquive l'attaque".
   - **Flee** (batch 3, `applyFlee`): possible only if an escape cell exists — any cell reachable with the normal movement rules (current PM) that is not next to the enemy (`fleeOptions`). Chance = (Luck + 2) / (Luck + enemy Agility + 4), clamped 10–90 %, shown on the "Fuir (xx %)" button.
     - **The player chooses the escape cell** (owner's request): "Fuir" marks the escape cells in green on the board, the banner moves to the top ("Choisis ta case de repli", button "Annuler"; clicks go through the banner to the board), a click on a green cell attempts the flee towards it. AIs flee to the cell farthest from the enemy (`fleeDestination`).
     - Success: the fight ends (both defenses reset), the fleer moves to the chosen escape cell (pickups and traps apply), then it is the enemy's turn.
     - Failure: the action is lost and the fight continues — the enemy plays next.
     - No other cost (owner's decision). A fight now ends with a death **or** a successful flee.
   - **Defend**: the attacker enters defense; the next hit they receive is halved.
   - **Spells** (batch 8, `applySpell`, buttons "Soin" / "Entrave" shown only when castable — `castableSpells`): each costs 20 mana and replaces the round's action; the caster's defense is consumed.
     - **Soin** (heal): restores 10 + 3 × Intelligence health, up to the starting health (not offered at full health).
     - **Entrave** (root): the enemy cannot flee during its next 3 fight actions (`rooted`; no escape cell, no "Fuir" button); cleared when the fight ends.
     - **Mana**: Intelligence × 10, full at the start, +Intelligence at the start of each of the player's turns on the board (up to the maximum). Shown in the sidebar ("Mana : 60 / 70") and next to the health in the fight banner.
     - Normal AI: heals when the next enemy hit is lethal and the heal lets it survive (before trying to flee); roots an enemy it can finish in two hits. Q-learning fight models do not use spells (their actions are attack / defend / flee).
3. After each action (500 ms), if the target's health is 0 the attacker wins (`gameover`); otherwise roles swap. A successful flee ends the fight immediately.
4. At the end: "Nouvelle partie" starts a new game in place with the same configuration (board size, item counts, game mode); characters and placements are drawn again. "Quitter" returns to the menu (configuration reset to defaults).

## AI

The AI plays player index 1. Modes: `easy`, `normal`, and `trained` ("IA Entraînée").

### Movement

Played 900 ms after the AI's turn starts.

- **Easy**: random reachable cell.
- **Normal**, by priority:
  1. If a security zone is reachable and the AI has the edge (weapon damage ≥ enemy's, or more health), go to the one closest to the enemy.
  2. Otherwise pick up a better weapon (closest to the enemy).
  3. Otherwise pick up a bonus (closest to the enemy).
  4. Otherwise move to the reachable cell closest to the enemy (Manhattan distance).

### Fight

When the AI is the attacker (fight start or new round), it acts 1500 ms later; the banner shows "<name> réfléchit…" instead of the Attack / Defend buttons, so the human cannot act for it.

- **Easy**: attack with 70 % probability, otherwise defend.
- **Normal**, by priority:
  1. Attack if the hit kills the enemy (damage halved if the enemy is defending).
  2. Otherwise, if the enemy's next hit can kill the AI: flee when the flee chance is at least 50 % and an escape cell exists, else defend (unless already defending).
  3. Otherwise attack.
- **Trained** ("IA Entraînée"): uses the models saved from the training page ("Utiliser dans le jeu", stored in the browser): one movement model — evolved weights or neural network, whichever was saved last — and the Q-learning fight table. For each missing model it plays like Normal.

### Training page (`#training`, menu "Entraîner l'IA")

- Two lessons:
  - **Combat (Q-learning)**: the learner moves like Normal and learns attack / defend against the chosen opponent (Aléatoire, IA Facile, IA Normal), starting from a blank (random) table.
  - **Déplacement (génétique)**: a population of 30 movement weight sets plays against the opponent (fights with Normal's rule); the best are kept, crossed and mutated each generation. Watching speeds show a demonstration game of the current champion.
  - **Réseau de neurones (imitation)**: a neural network learns to imitate the genetic champion from raw inputs (800 recorded games); progress by epochs, with training and test error curves. Watching speeds show a demonstration game of the network.
- Movement features and network inputs only use what a player can see on screen (hidden traps are never used).
- Speeds: Regarder (one action every 0.5 s, board shown), Rapide (every 50 ms, board shown), Turbo and Max (no board, many games per update).
- Shown: games played, exploration rate (Combat) or generations (Déplacement), win rate of the last evaluation against the opponent (400 fixed games, no exploration) and the Normal AI's win rate on the same games (reference), learning curve, and what was learned: map of the fight strategy or weights of the movement champion.
- Button "Équilibrage" opens the **Balance lab** (`#balance`): every character's health and movement points can be edited **in the lab only** (the game data is not changed); "Lancer l'analyse" makes every character fight every other one with the same AI on both sides (IA Normal, or the cautious genetic champion) and shows each one's win rate (red > 60 %, green 40–60 %, blue < 40 %), the duel matrix, the draw rate and the first-player advantage. "Copier les stats" copies the edited stats in the `PLAYER_DATA` format, to be written into the game by the owner's decision.
- "Recommencer", a change of lesson or of opponent reset the learning; "Utiliser dans le jeu" saves the model of the current lesson for the "IA Entraînée" mode.

## Character stats

Every character has Health, PM and four combat stats (Strength, Agility, Intelligence, Luck — see [`spec-game-design.md`](spec-game-design.md)). Implemented so far: **Strength** multiplies weapon damage by (1 + 5 % per point) (batch 1); **Agility** gives critical hits and **Luck** gives dodges (batch 2). **Intelligence** gives mana for spells (batch 8). Since batch 5 every character has a **class** (Brute, Ent, Voleur, Duelliste, and Mage since batch 8 — `characterClass`) and stats from its class template (same budget: Strength + Agility + Intelligence + Luck = 9; PM 2 / 2 / 5 / 3 / 3), each with one point moved between stats; health auto-tuned in batch 5 (Ent 106–115, Thief 91–96, others 100–102); the three Mages (Khadgar, Gunnar, Jail, taken from Brute, Ent and Thief) start at 100 HP. The sidebar shows the class under the name, and the four stats (FOR · AGI · INT · CHA).

## Content

- 15 characters (`PLAYER_DATA`), 12 weapons (15–40 damage, `WEAPON_DATA`; 4 heavy, 4 light, 4 balanced — first draft), 5 bonuses (`BONUS_DATA`), 5 traps sharing one image (`TRAP_DATA`).
- In-game rules modal lists every weapon with its damage and type; the sidebar and the board tooltip show the type too.
