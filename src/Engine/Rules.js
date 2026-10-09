import { createCell, DECOR } from '../Models/Cell.js';
import { WEAPON_TYPE } from '../Models/Weapon.js';
import { getMovableCells, getAdjacentPositions } from './MovementSystem.js';
import { PlayersRepository } from '../Repository/PlayersRepository.js';
import { WeaponsRepository } from '../Repository/WeaponsRepository.js';
import { BonusRepository } from '../Repository/BonusRepository.js';
import { TrapRepository } from '../Repository/TrapRepository.js';

/*
 * Règles du jeu sous forme de fonctions pures — aucun Store, EventBus, timer ni DOM.
 * Chaque action prend un état et retourne { state, events } :
 *   - state  : le nouvel état (l'état d'entrée n'est jamais modifié) ;
 *   - events : les événements à émettre, [{ name, payload }].
 * Une action refusée retourne l'état d'entrée tel quel (même référence) et aucun événement.
 *
 * Utilisées par GameEngine / FightEngine (jeu) et par GameEnv (simulation rapide pour l'IA).
 */

export const TRAP_DAMAGE = 20;

// Force : chaque point augmente les dégâts de l'arme de 5 % (docs/spec-game-design.md §3)
export const STRENGTH_BONUS = 0.05;

// Agilité : chance de coup critique (3 % par point, 40 % max), qui multiplie les dégâts par 1,5
export const CRITICAL_PER_AGILITY = 0.03;
export const CRITICAL_MAX         = 0.40;
export const CRITICAL_MULTIPLIER  = 1.5;

// Chance : chance d'esquiver complètement un coup (3 % par point, 35 % max)
export const DODGE_PER_LUCK = 0.03;
export const DODGE_MAX      = 0.35;

// Types d'armes (docs/spec-game-design.md §5) :
//   lourde : 7 % par point de Force au lieu de 5 % ;
//   légère : +10 % de chance de critique, plafond relevé à 50 %.
export const HEAVY_STRENGTH_BONUS  = 0.07;
export const LIGHT_CRITICAL_BONUS  = 0.10;
export const LIGHT_CRITICAL_MAX    = 0.50;

export function criticalChance(player, weapon = player.weapon) {
    const base = (player.agility ?? 0) * CRITICAL_PER_AGILITY;
    if (weapon?.type === WEAPON_TYPE.LIGHT) return Math.min(LIGHT_CRITICAL_MAX, base + LIGHT_CRITICAL_BONUS);
    return Math.min(CRITICAL_MAX, base);
}
export const dodgeChance    = player => Math.min(DODGE_MAX, (player.luck ?? 0) * DODGE_PER_LUCK);

/**
 * Dégâts d'une arme entre les mains d'un joueur (avant défense) :
 *   arrondi( dégâts de l'arme × (1 + Force × 5 %) )   — 7 % par point pour une arme lourde
 * Utilisée par les règles ET par les IA, pour qu'elles raisonnent sur les vrais dégâts.
 */
export function weaponDamage(player, weapon = player.weapon) {
    const perPoint = weapon.type === WEAPON_TYPE.HEAVY ? HEAVY_STRENGTH_BONUS : STRENGTH_BONUS;
    return Math.round(weapon.damage * (1 + (player.strength ?? 0) * perPoint));
}

// Initiative (docs/spec-game-design.md §8, option A) : le personnage qui a la plus haute commence la partie
export const initiative = player => (player.agility ?? 0) + (player.luck ?? 0) + 2 * player.maxMove;

/**
 * Index du joueur qui commence : la plus haute initiative ; en cas d'égalité, tirage au sort
 * (aucun tirage sinon, pour garder les parties reproductibles).
 */
export function firstPlayerIndex(players, rng = Math.random) {
    const [a, b] = players.map(p => initiative(p.player));
    if (a !== b) return a > b ? 0 : 1;
    return rng() < 0.5 ? 0 : 1;
}

// Mort subite (anti-blocage) : à partir du tour SUDDEN_DEATH_TURN (tours des deux joueurs comptés),
// le joueur qui commence son tour perd des PV : 5, puis +5 tous les 20 tours (5, 10, 15…)
export const SUDDEN_DEATH_TURN     = 80;
export const SUDDEN_DEATH_DAMAGE   = 5;
export const SUDDEN_DEATH_INTERVAL = 20;

export const suddenDeathDamage = turn => turn < SUDDEN_DEATH_TURN
    ? 0
    : SUDDEN_DEATH_DAMAGE * (1 + Math.floor((turn - SUDDEN_DEATH_TURN) / SUDDEN_DEATH_INTERVAL));

const unchanged = state => ({ state, events: [] });

// ─── Création d'une partie ────────────────────────────────────────────────────

export function createGame(config, rng = Math.random) {
    const cells = createGrid(config);
    placeObstacles(cells, config, rng);
    placeBonus(cells, config, rng);
    placeTraps(cells, config, rng);
    placeWeapons(cells, config, rng);
    const players = placePlayers(cells, config, rng);

    return refreshMarkings({
        phase: 'playing',
        config,
        cells,
        players,
        activePlayerIndex: firstPlayerIndex(players, rng),
        turn: 0,  // tours joués (les deux joueurs comptés) — pour la mort subite
        fight: null,
    });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

// Déplace le joueur actif ; gère piège, arme, bonus, puis duel ou tour suivant
export function applyMove(state, targetRow, targetCol) {
    const { cells, players, activePlayerIndex, phase } = state;

    if (phase !== 'playing') return unchanged(state);

    const targetCell = cells[targetRow]?.[targetCol];
    if (!targetCell?.isMovable) return unchanged(state);

    const activeInfo = players[activePlayerIndex];
    const isFightTrigger = targetCell.isSecurityZone;

    // Copie des cellules pour mise à jour immutable
    const newCells = cloneCells(cells);
    clearMarkings(newCells);

    // Déplace le joueur
    newCells[activeInfo.position.row][activeInfo.position.col].player = null;
    newCells[targetRow][targetCol].player = activeInfo.player;

    let updatedInfo = { ...activeInfo, position: { row: targetRow, col: targetCol } };

    // Piège
    let trapTriggered = false;
    if (targetCell.trap && !targetCell.trap.triggered) {
        updatedInfo = {
            ...updatedInfo,
            player: { ...updatedInfo.player, health: Math.max(0, updatedInfo.player.health - TRAP_DAMAGE) },
        };
        newCells[targetRow][targetCol].trap = { ...targetCell.trap, triggered: true };
        trapTriggered = true;
    }

    // Ramassage d'arme — échange avec l'arme actuelle du joueur
    if (targetCell.weapon) {
        const oldWeapon = updatedInfo.player.weapon;
        updatedInfo = {
            ...updatedInfo,
            player: { ...updatedInfo.player, weapon: targetCell.weapon },
        };
        newCells[targetRow][targetCol].weapon = oldWeapon;
    }

    // Ramassage de bonus
    if (targetCell.bonus) {
        const { type, amount } = targetCell.bonus;
        const playerUpdate = type === 'life'
            ? { health: updatedInfo.player.health + amount }
            : { maxMove: updatedInfo.player.maxMove + amount };
        updatedInfo = { ...updatedInfo, player: { ...updatedInfo.player, ...playerUpdate } };
        newCells[targetRow][targetCol].bonus = null;
    }

    const newPlayers = players.map((p, i) => i === activePlayerIndex ? updatedInfo : p);

    let next = { ...state, cells: newCells, players: newPlayers };
    const events = [];

    if (trapTriggered) {
        events.push({ name: 'trap:triggered', payload: { playerInfo: newPlayers[activePlayerIndex] } });
    }

    if (isFightTrigger) {
        const targetIndex = nextIndex(activePlayerIndex, newPlayers);
        next = { ...next, phase: 'fighting', fight: { attackerIndex: activePlayerIndex, targetIndex } };
        events.push({
            name: 'fight:start',
            payload: { attacker: newPlayers[activePlayerIndex], target: newPlayers[targetIndex] },
        });
        return { state: next, events };
    }

    return passTurn(next, events);
}

// Passe le tour sans bouger (utile quand aucune case n'est accessible)
export function applyPass(state) {
    if (state.phase !== 'playing') return unchanged(state);
    return passTurn(state, []);
}

// Début de partie : si le premier joueur est bloqué (aucune case accessible), il passe son tour
export function skipIfBlocked(state) {
    if (state.phase !== 'playing' || hasMovableCell(state)) return unchanged(state);
    return passTurn({ ...state, activePlayerIndex: nextIndex(state.activePlayerIndex, state.players) }, [], true);
}

/**
 * Attaque. Ordre de résolution :
 *   1. esquive  : la cible esquive avec la chance « Chance × 3 % » → 0 dégât ;
 *   2. critique : sinon, l'attaquant fait un critique avec la chance « Agilité × 3 % » → dégâts × 1,5 ;
 *   3. défense  : si la cible se défend, dégâts divisés par 2 (arrondi inférieur).
 * Les défenses des deux joueurs sont consommées. Aucun tirage n'est fait quand une chance vaut 0
 * (les parties sans Agilité ni Chance restent exactement reproductibles).
 * @param {() => number} rng  aléatoire (graine possible en simulation, Math.random en jeu)
 */
export function applyAttack(state, rng = Math.random) {
    const { fight, players, phase } = state;
    if (!fight || phase !== 'fighting') return unchanged(state);

    const { attackerIndex, targetIndex } = fight;
    const attacker = players[attackerIndex];
    const target   = players[targetIndex];

    const dodgeP    = dodgeChance(target.player);
    const criticalP = criticalChance(attacker.player);
    const dodged    = dodgeP > 0 && rng() < dodgeP;
    const critical  = !dodged && criticalP > 0 && rng() < criticalP;

    let damage = 0;
    if (!dodged) {
        damage = weaponDamage(attacker.player);
        if (critical) damage = Math.round(damage * CRITICAL_MULTIPLIER);
        if (target.player.defense) damage = Math.floor(damage / 2);
    }

    const newHealth = Math.max(0, target.player.health - damage);

    const newPlayers = players.map((p, i) => {
        if (i === targetIndex)   return { ...p, player: { ...p.player, health: newHealth, defense: false } };
        if (i === attackerIndex) return { ...p, player: { ...p.player, defense: false } };
        return p;
    });

    return {
        state: { ...state, players: newPlayers },
        events: [{
            name: 'fight:attack',
            payload: { attacker: newPlayers[attackerIndex], target: newPlayers[targetIndex], damage, critical, dodged },
        }],
    };
}

// Défense : le prochain coup reçu par l'attaquant est divisé par 2
export function applyDefend(state) {
    const { fight, players, phase } = state;
    if (!fight || phase !== 'fighting') return unchanged(state);

    const { attackerIndex, targetIndex } = fight;
    const newPlayers = players.map((p, i) =>
        i === attackerIndex ? { ...p, player: { ...p.player, defense: true } } : p
    );

    return {
        state: { ...state, players: newPlayers },
        events: [{
            name: 'fight:defend',
            payload: { attacker: newPlayers[attackerIndex], target: newPlayers[targetIndex] },
        }],
    };
}

// ─── Sorts (lot 8) ────────────────────────────────────────────────────────────

// Coût de chaque sort ; Soin : 10 + 3 × Intelligence PV (sans dépasser les PV de départ) ;
// Entrave : la cible ne peut plus fuir pendant ses 3 prochaines actions de combat
export const SPELL_COST       = 20;
export const HEAL_BASE        = 10;
export const HEAL_PER_INT     = 3;
export const ROOT_ACTIONS     = 3;
export const SPELLS           = ['heal', 'root'];

export const healAmount = player => HEAL_BASE + HEAL_PER_INT * (player.intelligence ?? 0);

// Sorts que le combattant actif peut lancer maintenant (assez de mana ; Soin inutile à PV pleins)
export function castableSpells(state) {
    const { fight, players } = state;
    if (!fight) return [];
    const caster = players[fight.attackerIndex].player;
    if ((caster.mana ?? 0) < SPELL_COST) return [];
    return SPELLS.filter(spell => spell !== 'heal' || caster.health < caster.maxHealth);
}

/**
 * Lance un sort à la place de l'action du round. La défense du lanceur est consommée.
 * Refusé si le sort n'est pas lançable (castableSpells).
 */
export function applySpell(state, spell) {
    const { fight, players, phase } = state;
    if (!fight || phase !== 'fighting' || !castableSpells(state).includes(spell)) return unchanged(state);

    const { attackerIndex, targetIndex } = fight;
    const caster = players[attackerIndex].player;
    let amount = 0;

    const newPlayers = players.map((p, i) => {
        if (i === attackerIndex) {
            const health = spell === 'heal' ? Math.min(caster.maxHealth, caster.health + healAmount(caster)) : caster.health;
            amount = spell === 'heal' ? health - caster.health : ROOT_ACTIONS;
            return { ...p, player: { ...caster, health, mana: caster.mana - SPELL_COST, defense: false } };
        }
        if (i === targetIndex && spell === 'root') return { ...p, player: { ...p.player, rooted: ROOT_ACTIONS } };
        return p;
    });

    return {
        state: { ...state, players: newPlayers },
        events: [{
            name: 'fight:spell',
            payload: { caster: newPlayers[attackerIndex], target: newPlayers[targetIndex], spell, amount },
        }],
    };
}

// ─── Fuite (lot 3) ────────────────────────────────────────────────────────────

// Chance de fuir : la Chance du fuyard contre le tacle (Agilité) de l'adversaire
//   (Chance + 2) / (Chance + tacle adverse + 4), bornée entre 10 % et 90 %
export const FLEE_MIN = 0.10;
export const FLEE_MAX = 0.90;

export function fleeChance(fleer, enemy) {
    const luck = fleer.luck ?? 0, tackle = enemy.agility ?? 0;
    return Math.min(FLEE_MAX, Math.max(FLEE_MIN, (luck + 2) / (luck + tackle + 4)));
}

/**
 * Cases de repli possibles du combattant qui doit jouer : les cases accessibles (règles de
 * déplacement normales, ses PM) qui ne sont pas collées à l'adversaire. Vide → fuite impossible.
 */
export function fleeOptions(state) {
    const { fight, players, cells, config } = state;
    if (!fight) return [];

    const fleer = players[fight.attackerIndex], enemy = players[fight.targetIndex];
    if (fleer.player.rooted > 0) return []; // Entrave (lot 8) : impossible de fuir
    return getMovableCells(fleer.position, fleer.player.maxMove, cells, config)
        .filter(c => Math.abs(c.row - enemy.position.row) + Math.abs(c.col - enemy.position.col) > 1);
}

// Case de repli par défaut (choix des IA) : la plus éloignée de l'adversaire. null si aucune.
export function fleeDestination(state) {
    const options = fleeOptions(state);
    if (options.length === 0) return null;

    const enemy = state.players[state.fight.targetIndex].position;
    const distance = c => Math.abs(c.row - enemy.row) + Math.abs(c.col - enemy.col);
    return options.reduce((best, c) => (distance(c) > distance(best) ? c : best));
}

// Choix de la fuite (joueur humain) : marque les cases de repli sur le plateau, ou retire ce marquage
export function markEscapeCells(state) {
    const options = fleeOptions(state);
    if (options.length === 0) return unchanged(state);
    const cells = cloneCells(state.cells);
    for (const c of options) cells[c.row][c.col].isEscape = true;
    return { state: { ...state, cells }, events: [] };
}

export function clearEscapeCells(state) {
    if (!state.cells.some(row => row.some(c => c.isEscape))) return unchanged(state);
    const cells = state.cells.map(row => row.map(c => (c.isEscape ? { ...c, isEscape: false } : c)));
    return { state: { ...state, cells }, events: [] };
}

/**
 * Tentative de fuite du combattant qui doit jouer (à la place d'une attaque), vers `target` (case de repli
 * choisie par le joueur) ou, sans target, vers la case de repli la plus éloignée (choix des IA).
 *   - réussite : le combat s'arrête, le fuyard se déplace vers sa case de repli (ramassage et pièges
 *     comme un déplacement normal), puis c'est le tour de l'adversaire ;
 *   - échec : le tour est perdu, le combat continue (resolveRound donne la main à l'adversaire).
 * Refusée si aucune case de repli n'existe.
 * @param {() => number} rng  aléatoire (graine possible en simulation, Math.random en jeu)
 */
export function applyFlee(state, rng = Math.random, target = null) {
    const { fight, players, phase } = state;
    if (!fight || phase !== 'fighting') return unchanged(state);

    // Case choisie par le joueur (doit être une case de repli valide), sinon la plus éloignée
    const destination = target
        ? fleeOptions(state).find(c => c.row === target.row && c.col === target.col)
        : fleeDestination(state);
    if (!destination) return unchanged(state);

    const { attackerIndex, targetIndex } = fight;
    const chance  = fleeChance(players[attackerIndex].player, players[targetIndex].player);
    const success = rng() < chance;
    const fleeEvent = s => ({
        name: 'fight:flee',
        payload: { fleer: s.players[attackerIndex], enemy: s.players[targetIndex], success, chance },
    });

    if (!success) {
        const next = clearEscapeCells({ ...state }).state; // nouvel état : l'action est jouée, même ratée
        return { state: next, events: [fleeEvent(next)] };
    }

    // Le combat est fini : défenses remises à zéro, puis déplacement normal du fuyard vers sa case de repli
    const calmed  = players.map(p => ({ ...p, player: { ...p.player, defense: false, rooted: 0 } }));
    const playing = refreshMarkings({ ...state, phase: 'playing', fight: null, players: calmed, activePlayerIndex: attackerIndex });
    const moved   = applyMove(playing, destination.row, destination.col);
    return { state: moved.state, events: [fleeEvent(moved.state), ...moved.events] };
}

// Fin d'un round de combat : victoire si la cible n'a plus de vie, sinon échange des rôles
export function resolveRound(state, attackerIndex, targetIndex) {
    const { players } = state;
    const attacker = players[attackerIndex];
    const target   = players[targetIndex];

    if (target.player.health <= 0) {
        return {
            state: { ...state, phase: 'gameover', fight: null },
            events: [{ name: 'fight:end', payload: { winner: attacker, loser: target } }],
        };
    }

    // Entrave : chaque action de combat du joueur entravé en consomme une
    const newPlayers = attacker.player.rooted > 0
        ? players.map((p, i) => (i === attackerIndex ? { ...p, player: { ...p.player, rooted: p.player.rooted - 1 } } : p))
        : players;

    return {
        state: { ...state, players: newPlayers, phase: 'fighting', fight: { attackerIndex: targetIndex, targetIndex: attackerIndex } },
        events: [{ name: 'fight:round-end', payload: { nextAttacker: target, nextTarget: attacker } }],
    };
}

// ─── Marquage des cases ───────────────────────────────────────────────────────

// Recalcule les cases accessibles au joueur actif et les zones de duel (à côté du joueur en attente)
export function refreshMarkings(state) {
    const { cells, players, activePlayerIndex, config } = state;
    const activeInfo  = players[activePlayerIndex];
    const waitingInfo = players[nextIndex(activePlayerIndex, players)];

    const newCells = cloneCells(cells);
    clearMarkings(newCells);

    for (const cell of getMovableCells(activeInfo.position, activeInfo.player.maxMove, newCells, config)) {
        newCells[cell.row][cell.col].isMovable = true;
    }

    for (const pos of getAdjacentPositions(waitingInfo.position, config)) {
        const cell = newCells[pos.row][pos.col];
        if (cell.decor === DECOR.FLOOR && !cell.player) cell.isSecurityZone = true;
    }

    return { ...state, cells: newCells };
}

// ─── Helpers privés ───────────────────────────────────────────────────────────

const nextIndex = (index, players) => (index + 1) % players.length;

const hasMovableCell = state => state.cells.some(row => row.some(cell => cell.isMovable));

// Donne le tour au joueur suivant. S'il est bloqué (aucune case accessible), il passe
// automatiquement son tour (événement turn:skipped) et la main revient au joueur d'avant.
// Si les deux joueurs sont bloqués, la partie ne peut plus avancer (cas extrêmement rare).
// fromSkip : appelé par skipIfBlocked, le tour du joueur bloqué a déjà été sauté
function passTurn(state, events, fromSkip = false) {
    let next = fromSkip ? state.activePlayerIndex : nextIndex(state.activePlayerIndex, state.players);
    const turn = (state.turn ?? 0) + 1;
    let nextState = refreshMarkings({ ...state, activePlayerIndex: next, turn });
    const out = [...events];

    if (fromSkip) {
        out.push({ name: 'turn:skipped', payload: { playerInfo: state.players[nextIndex(next, state.players)] } });
    } else if (!hasMovableCell(nextState)) {
        out.push({ name: 'turn:skipped', payload: { playerInfo: nextState.players[next] } });
        next = nextIndex(next, state.players);
        nextState = refreshMarkings({ ...nextState, activePlayerIndex: next });
    }

    // Début de tour : le joueur récupère Intelligence points de mana (lot 8),
    // puis la mort subite lui fait perdre des PV (lot 6) — à 0, il perd la partie
    const starting = nextState.players[next].player;
    const mana     = Math.min(starting.maxMana ?? 0, (starting.mana ?? 0) + (starting.intelligence ?? 0));
    const damage   = suddenDeathDamage(turn);
    if (damage > 0 || mana !== (starting.mana ?? 0)) {
        const updated = { ...starting, mana, health: Math.max(0, starting.health - damage) };
        const players = nextState.players.map((p, i) => (i === next ? { ...p, player: updated } : p));
        const cells = cloneCells(nextState.cells);
        const { row, col } = players[next].position;
        cells[row][col].player = updated;
        nextState = { ...nextState, players, cells };
    }
    if (damage > 0) {
        const players = nextState.players;
        out.push({ name: 'sudden-death:hit', payload: { playerInfo: players[next], damage, turn } });

        if (players[next].player.health <= 0) {
            const winner = players[nextIndex(next, players)];
            out.push({ name: 'game:over', payload: { winner, loser: players[next], reason: 'sudden-death' } });
            return { state: { ...nextState, phase: 'gameover' }, events: out };
        }
    }

    out.push({ name: 'turn:changed', payload: { activePlayerIndex: next } });
    return { state: nextState, events: out };
}

function clearMarkings(cells) {
    for (const row of cells) {
        for (const cell of row) {
            cell.isMovable = false;
            cell.isSecurityZone = false;
            cell.isEscape = false;
        }
    }
}

function cloneCells(cells) {
    return cells.map(row => row.map(cell => ({ ...cell })));
}

function createGrid({ rows, cols }) {
    return Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => createCell(row, col))
    );
}

// Cherche une cellule sol vide parmi toutes les cellules (pas de boucle infinie)
function randomEmptyCell(cells, config, rng) {
    const { rows, cols } = config;
    const empty = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = cells[r][c];
            if (cell.decor === DECOR.FLOOR && !cell.player && !cell.weapon && !cell.bonus && !cell.trap) {
                empty.push({ row: r, col: c });
            }
        }
    }

    if (empty.length === 0) throw new Error('Aucune cellule vide disponible sur le plateau.');
    return empty[Math.floor(rng() * empty.length)];
}

function shuffleArray(array, rng) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function placeObstacles(cells, config, rng) {
    for (let k = 0; k < config.nbObstacles; k++) {
        const { row, col } = randomEmptyCell(cells, config, rng);
        cells[row][col].decor = DECOR.OBSTACLE;
    }
}

function placeWeapons(cells, config, rng) {
    const weapons = shuffleArray(WeaponsRepository.findAll(), rng);
    for (let k = 0; k < config.nbWeapons; k++) {
        const { row, col } = randomEmptyCell(cells, config, rng);
        cells[row][col].weapon = weapons[k % weapons.length];
    }
}

function placeBonus(cells, config, rng) {
    const bonuses = shuffleArray(BonusRepository.findAll(), rng);
    for (let k = 0; k < config.nbBonus; k++) {
        const { row, col } = randomEmptyCell(cells, config, rng);
        cells[row][col].bonus = bonuses[k % bonuses.length];
    }
}

function placeTraps(cells, config, rng) {
    const traps = shuffleArray(TrapRepository.findAll(), rng);
    for (let k = 0; k < config.nbTraps; k++) {
        const { row, col } = randomEmptyCell(cells, config, rng);
        cells[row][col].trap = { ...traps[k % traps.length], triggered: false };
    }
}

function placePlayers(cells, config, rng) {
    const allPlayers = shuffleArray(PlayersRepository.findAll(), rng);
    const players = [];

    for (let k = 0; k < 2; k++) {
        const { row, col } = randomEmptyCell(cells, config, rng);
        // Copie profonde suffisante pour l'arme de base
        const player = { ...allPlayers[k], weapon: { ...allPlayers[k].weapon } };
        player.initiative = initiative(player); // calculée une fois, au début de la partie (affichée par la barre latérale)

        // Le joueur à l'index 1 est toujours le bot si un mode IA est sélectionné
        if (k === 1 && config.aiMode && config.aiMode !== 'none') {
            player.isAI = true;
        }

        const playerInfo = { player, position: { row, col } };
        cells[row][col].player = player;
        players.push(playerInfo);
    }

    return players;
}
