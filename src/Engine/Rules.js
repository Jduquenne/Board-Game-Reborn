import { createCell, DECOR } from '../Models/Cell.js';
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

/**
 * Dégâts d'une arme entre les mains d'un joueur (avant défense) :
 *   arrondi( dégâts de l'arme × (1 + Force × 5 %) )
 * Utilisée par les règles ET par les IA, pour qu'elles raisonnent sur les vrais dégâts.
 */
export function weaponDamage(player, weapon = player.weapon) {
    return Math.round(weapon.damage * (1 + (player.strength ?? 0) * STRENGTH_BONUS));
}

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
        activePlayerIndex: 0,
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

// Attaque : dégâts de l'arme (avec la Force), divisés par 2 si la cible se défend ; les défenses sont consommées
export function applyAttack(state) {
    const { fight, players, phase } = state;
    if (!fight || phase !== 'fighting') return unchanged(state);

    const { attackerIndex, targetIndex } = fight;
    const attacker = players[attackerIndex];
    const target   = players[targetIndex];

    let damage = weaponDamage(attacker.player);
    if (target.player.defense) damage = Math.floor(damage / 2);

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
            payload: { attacker: newPlayers[attackerIndex], target: newPlayers[targetIndex], damage },
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

    return {
        state: { ...state, phase: 'fighting', fight: { attackerIndex: targetIndex, targetIndex: attackerIndex } },
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
    let nextState = refreshMarkings({ ...state, activePlayerIndex: next });
    const out = [...events];

    if (fromSkip) {
        out.push({ name: 'turn:skipped', payload: { playerInfo: state.players[nextIndex(next, state.players)] } });
    } else if (!hasMovableCell(nextState)) {
        out.push({ name: 'turn:skipped', payload: { playerInfo: nextState.players[next] } });
        next = nextIndex(next, state.players);
        nextState = refreshMarkings({ ...nextState, activePlayerIndex: next });
    }

    out.push({ name: 'turn:changed', payload: { activePlayerIndex: next } });
    return { state: nextState, events: out };
}

function clearMarkings(cells) {
    for (const row of cells) {
        for (const cell of row) {
            cell.isMovable = false;
            cell.isSecurityZone = false;
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
