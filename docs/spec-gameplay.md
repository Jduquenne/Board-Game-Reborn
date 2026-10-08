# Gameplay specification

> Derived from code on 2026-10-08 (`GameEngine.js`, `FightEngine.js`, `AIEngine.js`, `MovementSystem.js`, repositories, `OptionsView.js`). This describes current behaviour, not a target. Changes to the rules must update this file.

BoardGame Reborn is a turn-based, two-player duel on a grid. Players move, pick up weapons and bonuses, avoid traps, and fight when they meet. The last player standing wins.

## Setup

1. A `rows × cols` grid of floor cells is created.
2. Items are placed on random empty floor cells, in this order: obstacles, bonuses, traps, weapons, then the 2 players.
3. Weapons, bonuses and traps are drawn from a shuffled repository list (cycling if more are requested than exist).
4. The 2 characters are drawn at random from `PLAYER_DATA`. Each starts with the default weapon "Épée de boisaille" (10 damage).
5. If an AI mode is selected, the player at index 1 is the AI.
6. Player 0 starts.

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
- "Security zones" are the empty floor cells adjacent to the waiting player. Moving onto one starts a fight instead of ending the turn.

## Pickups and traps (on the destination cell)

- **Trap** (not yet triggered): −20 health (minimum 0); the trap becomes triggered and visible.
- **Weapon**: swapped with the player's current weapon (the old weapon stays on the cell).
- **Bonus**: `life` adds `amount` to health (no cap at `maxHealth`); `move` adds `amount` to `maxMove`. The bonus is removed.

## Fight

1. The player who moved into the security zone attacks first.
2. Each round, the attacker chooses **Attack** or **Defend**:
   - **Attack**: deals the weapon's damage to the target; halved (rounded down) if the target is defending. Defense flags of both players reset.
   - **Defend**: the attacker enters defense; the next hit they receive is halved.
3. After each action (500 ms), if the target's health is 0 the attacker wins (`gameover`); otherwise roles swap.
4. At the end: "Nouvelle partie" starts a new game in place with the same configuration (board size, item counts, game mode); characters and placements are drawn again. "Quitter" returns to the menu (configuration reset to defaults).

## AI

The AI plays player index 1.

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
  2. Otherwise defend if the enemy's next hit can kill the AI and the AI is not already defending.
  3. Otherwise attack.

## Content

- 15 characters (`PLAYER_DATA`), 12 weapons (15–40 damage, `WEAPON_DATA`), 5 bonuses (`BONUS_DATA`), 5 traps sharing one image (`TRAP_DATA`).
- In-game rules modal lists every weapon with its damage.
