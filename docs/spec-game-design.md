# Game design specification — characters, stats, combat

> **Status: DRAFT v0.3 (2026-10-08) — proposal, nothing implemented.** Stats, their roles, the flee rule and the classes come from the owner; formulas marked "proposal" are still to be validated (they will be tuned in the Balance lab). Once validated, the rules move to [`spec-gameplay.md`](spec-gameplay.md) as they are implemented, batch by batch.
>
> Changes in v0.3: flee formula accepted for a first version; failure = free enemy attack; **no extra cost** for a successful flee (fleeing simply replaces the attack and, if it succeeds, avoids the enemy's next attack); classes renamed (Rogue → **Thief / Voleur**, Jailer → **Ent**, who grabs its victims with roots); characters assigned to classes **at random** (owner's choice); **Initiative** proposed to decide who plays first.
>
> Changes in v0.2: stats decided by the owner (Health, Strength, Agility, Intelligence, Luck — Armour removed); Agility = critical hits **and tackle**; Luck = dodge **and flee**; Intelligence = mana for future spells; flee chance depends on the fleeing character's Luck **against the enemy's tackle**.

## 1. Why

Measured with the balance tool (devlog 2026-10-08): with only health and movement points (PM), characters cannot be balanced without making them identical.

- In a fight, only health and the weapon matter; PM are only used to walk. 1 PM ≈ +2 % win rate, 25 HP ≈ +20 %.
- A fight always ends with a death: once adjacent, nobody can leave.
- A cautious player can flee forever on the board (58 % draws between two cautious AIs).
- The first player wins 57–63 % of decided games.

## 2. Design goals

1. **Every stat changes the outcome of a fight**, otherwise it cannot be traded against the others.
2. **Counters instead of a ranking**: every character around 50 % overall, but with favourable and unfavourable matchups (rock–paper–scissors).
3. **Fights are tactical decisions**: attack, defend or **flee**, depending on the situation — and some characters are good at keeping their enemy in the fight (tackle).
4. **Readable**: a player understands why they won or lost (chances and numbers shown in the fight banner).
5. **Measurable**: every change is checked in the Balance lab before being kept.

## 3. Stats (decided by the owner)

| Stat | Short | Role (owner) | Proposed effect (formulas: proposal) | Typical range |
|---|---|---|---|---|
| Health | HP | Damage a character can take | as today | 60–200 |
| Strength | STR | Power of the weapon's damage | damage × (1 + STR × 5 %) | 0–10 |
| Agility | AGI | **Critical hits** and **tackle** | critical chance = AGI × 3 % (max 40 %); tackle = AGI (see §4.3) | 0–10 |
| Intelligence | INT | **Mana** for future spells (heal, hinder) | mana = INT × 10; no effect until spells exist (§6) | 0–10 |
| Luck | LCK | **Dodge** and **fleeing** | dodge chance = LCK × 3 % (max 35 %); flee: see §4.3 | 0–10 |
| Movement | PM | Cells per move (unchanged); needed to flee | at least 1 PM to flee; distance covered when fleeing | 1–6 |

Removed from v0.1: Armour.

## 4. Combat (proposal)

The fight still starts when a player stops next to the other (duel cell) and attacks first. Each round, the active fighter chooses one of **three** actions.

### 4.1 Attack

```
base      = weapon damage × (1 + STR × 5 %)
critical  = with chance AGI × 3 % (max 40 %)      → base × 1.5
dodge     = target dodges with chance LCK × 3 % (max 35 %) → 0 damage
final     = round(base or critical), halved if the target is defending
```

Examples: Excalibur (40) with STR 10 → 60 per hit, 90 on a critical. A dagger (20) with STR 0 but AGI 10 → 20, critical 30 % of the time.

### 4.2 Defend

As today: the next hit taken is halved. Proposal: defending also gives +10 % to the next flee attempt (the character is already backing away).

### 4.3 Flee (new) — Luck against tackle

Possible only with **PM ≥ 1**. The fleeing character's **Luck** is opposed to the enemy's **tackle** (= the enemy's Agility):

```
flee chance = (LCK + 2) / (LCK + enemy AGI + 4)      clamped between 10 % and 90 %
```

| My Luck | Enemy tackle (AGI) | Flee chance |
|---|---|---|
| 5 | 5 | 50 % |
| 10 | 2 | 75 % |
| 2 | 10 | 25 % |
| 0 | 0 | 50 % |
| 10 | 10 | 50 % |

- Equal values → one chance in two; the higher my Luck compared to their tackle, the easier it is to escape. Close to the "flee / tackle" mechanic of some tactical RPGs.
- **Success**: the fight ends; the fleeing character moves up to PM cells away from the enemy (straight line, normal movement rules), then the turn passes to the enemy.
- **Failure** (owner, v0.3): the turn is lost and the enemy gets a **free attack** — the risk of running away.
- **No extra cost** (owner, v0.3): fleeing is simply a third choice — instead of attacking, the character tries to get away; if it works, they avoid the enemy's next attack.

A fight no longer always ends with a death: it ends when one character dies **or** flees successfully. Characters with high Agility become "jailers" (enemies cannot escape them); characters with high Luck become "escape artists".

## 5. Weapons (proposal)

Strength multiplies every weapon's damage, so a strong character wants the heaviest weapon. To make weapons "suited to some stats" (owner's wish), proposal: each weapon gets a **type** with a small bonus:

| Type | Bonus | Example weapons | Suits |
|---|---|---|---|
| Heavy | +STR effect (× 1 + STR × 7 % instead of 5 %) | Marteau du destin, Excalibur | strong characters |
| Light | +10 % critical chance (cap raised to 50 %) | Aiguille, Shuriken de Zorro | agile characters |
| Balanced | none | Quel'delar, Gressil | everyone |

Ranged weapons (attack from 2 cells) are kept for later: they need new rules.

## 6. Intelligence, mana and spells (future)

Intelligence gives mana (INT × 10). Spells are a later batch; first ideas from the owner:

- **Heal**: restore health, costs mana.
- **Hinder** (entrave): e.g. remove the enemy's PM for a turn, or prevent them from fleeing.

Until spells exist, Intelligence has **no effect**: characters should not spend points in it yet (the balance lab will show it).

## 7. Characters and classes (proposal)

Each character gets the same **budget of stat points** (exact budget to be tuned in the lab), spent according to a class:

| Class (UI name) | Strengths | Weaknesses | Plays like |
|---|---|---|---|
| Brute | STR, HP | AGI, LCK | huge hits, but can be escaped and cannot escape |
| Ent | HP, AGI (tackle) | STR | grabs its victims with roots: enemies can hardly flee, then it wears them down |
| Thief (Voleur) | LCK, PM | HP, STR | dodges, flees, comes back with a better weapon |
| Duellist (Duelliste) | AGI, STR | HP, LCK | critical hits, ends fights quickly |
| Mage (later) | INT | HP | spells (once implemented) |

Mapping of the 15 characters — **random**, as asked by the owner (shuffle with seed 2026, then dealt in turn; can be changed at any time):

| Class | Characters |
|---|---|
| Brute | ElonMusk, Indiana, Yggdrassil, Khadgar |
| Ent | Xena, Björn, Brutus, Gunnar |
| Thief (Voleur) | Prirodny, Lancelot, Bolvar, Jail |
| Duellist (Duelliste) | Thork, Vanessa VanCleef, Kerhs |

Each character's exact stats are derived from its class and the common budget, then tuned in the Balance lab.

## 8. Other rules to decide

- **First-player advantage** (57–63 %) — owner's idea: an **Initiative** stat decides who plays first, so the advantage becomes something a character "pays for" in its stats instead of luck. Rule: at the start of a game, the character with the higher initiative plays first; on a tie, a coin flip (seeded). Two ways to compute it (to choose):
  - **A. Derived** (no new points): `Initiative = AGI + LCK + 2 × PM` — fast, lucky and agile characters act first; makes those stats a bit more valuable.
  - **B. Its own stat** (INI, 0–10, bought with the budget like the others) — full control in the balance lab, one more choice when building a character.
  - Possible extension (later): initiative also decides who strikes first when a fight starts if the defender's initiative is much higher (ambush).
- **Stalemate** (cautious players avoiding each other): board that shrinks after N turns, or damage to both players each turn after N turns ("sudden death"). Fleeing makes this question more important.
- **Randomness**: dodge, criticals and flee add luck to fights. The rules will use the game's seeded random generator, so simulations and tests stay reproducible.

## 9. Impact on the project

- **Rules** (`Rules.js`): new player model, damage formula with randomness (seeded), new action `flee`, end of a fight without death.
- **Data**: stats for every character, type for every weapon.
- **UI**: character sheet (sidebar), flee button and flee chance shown in the fight banner, details of each hit (dodge, critical).
- **AI**: all agents (scripted, Q-learning, genetic, neural) must handle the new stats and the flee action; trained models must be retrained.
- **Balance lab**: edit all stats; optional automatic search of balanced stats per class (genetic algorithm).
- **Tests**: every formula tested with a fixed seed.

## 10. Delivery in batches (proposal)

1. ✅ Stats model (HP, STR, AGI, INT, LCK, PM) + Strength in the damage formula — done 2026-10-08 (all characters at 0, so no gameplay change yet; Strength editable in the Balance lab).
2. ✅ Agility criticals and Luck dodge (seeded randomness in the rules) — done 2026-10-08 (`applyAttack(state, rng)`; no draw when both chances are 0; dodge and critical shown in the fight banner; Agility and Luck editable in the Balance lab).
3. ✅ **Flee** action with Luck against tackle (rules, UI, AIs) — done 2026-10-08 (`applyFlee`, escape cell = farthest reachable cell not next to the enemy; "Fuir (xx %)" button; Normal AI flees when the next enemy hit is lethal and the chance ≥ 50 %; Q-learning gets a 3rd action; defend's +10 % flee bonus from v0.2 not implemented). Owner's follow-up the same day: the **player chooses the escape cell** among all reachable cells not next to the enemy; AIs keep the farthest one.
4. ✅ Weapon types — done 2026-10-09 (`type` on weapons; heavy: 7 % per Strength point; light: +10 % critical chance, cap 50 % — owner's choice; first-draft mapping: heavy Excalibur, Hurlesang, Marteau du destin, Skyword; light Deuilleombre, Aiguille, Shuriken de Zorro, Firefox; balanced Arc de Nodens, Quel'delar, Lame du puits de soleil, Gressil).
5. ✅ Classes, character stats, balancing — done 2026-10-09: `characterClass` on characters; class templates (budget STR + AGI + LCK = 9): Brute 7/1/1 PM 2, Ent 2/6/1 PM 2, Thief 1/2/6 PM 5, Duellist 4/5/0 PM 3; each character moves one point (seed 2026). At 100 HP (IA Normal): Thief 57.5 %, Duellist 49.7 %, Brute 48.1 %, Ent 41.0 % — Thief beats every class, no counters yet. Auto-tuned health applied (owner): Ent 106–115, Thief 91–96, others 100–102 → 46.7–51.2 % per character, every class against class between 46 and 52 % (flat: no rock–paper–scissors yet).
6. ✅ Anti-stalemate and first-player rules — done 2026-10-09 (owner: initiative **A**, derived = AGI + LCK + 2 × PM, tie → coin flip; **sudden death** from turn 80: 5 HP, +5 every 20 turns, at the start of each turn). Effect (IA Normal): draws 2.0 % → 0 %; the first-player advantage stays (≈ 55 %) but goes to high-initiative characters (Thief 54.4 %, Brute 45.4 % before re-tuning health).
7. Retrain the AIs.
8. Later: Intelligence, mana and spells.

Each batch: tests, Balance lab measurement, owner check in the browser.

## 11. Open questions for the owner

1. ~~Stat list~~ — decided in v0.2.
2. ~~Flee formula and failure~~ — accepted for a first version (v0.3).
3. ~~Cost of a successful flee~~ — none (v0.3).
4. Formulas for Strength (+5 % per point), criticals (AGI × 3 %, × 1.5) and dodge (LCK × 3 %): OK as a starting point, to be tuned in the lab?
5. ~~Classes and mapping~~ — Brute, Ent, Thief, Duellist (+ Mage later), random mapping (v0.3).
6. ~~Initiative and anti-stalemate~~ — derived initiative (A) and sudden death (2026-10-09).
7. ~~Order of the batches~~ — accepted by the owner (§10).
