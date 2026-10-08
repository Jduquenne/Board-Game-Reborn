import { DECOR } from '../Models/Cell.js';
import { normalAgent } from './ScriptedAgents.js';

/*
 * Déplacement par réseau de neurones : le réseau note chaque case accessible, l'agent va sur
 * la mieux notée. Contrairement à MoveFeatures.js (9 caractéristiques choisies à la main), le
 * réseau reçoit des données « brutes » et doit découvrir lui-même ce qui compte :
 *
 *   - une vue 5 × 5 centrée sur la case candidate, 6 informations par case :
 *     bloqué (obstacle ou hors plateau), arme (dégâts), bonus de vie, bonus de PM, ennemi, piège déjà déclenché ;
 *   - 9 valeurs globales : mes PV, ses PV, mes dégâts, ses dégâts, mes PM, ses PM,
 *     case de duel (cerclée de rouge à l'écran), position de l'ennemi par rapport à la case (lignes, colonnes).
 *
 * Toutes ces informations sont visibles à l'écran (les pièges cachés ne sont jamais utilisés).
 * Valeurs ramenées environ entre 0 et 1 pour que le réseau apprenne bien (normalisation).
 */

const VIEW_RADIUS = 2;                                    // vue 5 × 5 (7 × 7 essayé : pas mieux, deux fois plus lent)
const VIEW_SIZE   = (2 * VIEW_RADIUS + 1) ** 2;           // 25 cases
const CHANNELS    = 6;
const GLOBALS     = 9;

export const MOVE_INPUT_SIZE = VIEW_SIZE * CHANNELS + GLOBALS; // 159

/** Entrées du réseau pour une case candidate, du point de vue du joueur actif. */
export function moveInputs(state, cell) {
    const { cells, players, activePlayerIndex, config } = state;
    const me    = players[activePlayerIndex];
    const enemy = players[(activePlayerIndex + 1) % players.length];
    const input = new Float64Array(MOVE_INPUT_SIZE);

    let k = 0;
    for (let dr = -VIEW_RADIUS; dr <= VIEW_RADIUS; dr++) {
        for (let dc = -VIEW_RADIUS; dc <= VIEW_RADIUS; dc++) {
            const row = cell.row + dr, col = cell.col + dc;
            const c = cells[row]?.[col];
            if (!c) {
                input[k] = 1;                               // hors plateau = bloqué
            } else {
                const isEnemy = row === enemy.position.row && col === enemy.position.col;
                input[k]     = c.decor === DECOR.OBSTACLE ? 1 : 0;
                input[k + 1] = c.weapon ? c.weapon.damage / 40 : 0;
                input[k + 2] = c.bonus?.type === 'life' ? c.bonus.amount / 100 : 0;
                input[k + 3] = c.bonus?.type === 'move' ? c.bonus.amount / 3 : 0;
                input[k + 4] = isEnemy ? 1 : 0;
                input[k + 5] = c.trap?.triggered ? 1 : 0;   // seuls les pièges déclenchés sont visibles
            }
            k += CHANNELS;
        }
    }

    input[k++] = me.player.health / 300;
    input[k++] = enemy.player.health / 300;
    input[k++] = me.player.weapon.damage / 40;
    input[k++] = enemy.player.weapon.damage / 40;
    input[k++] = me.player.maxMove / 6;
    input[k++] = enemy.player.maxMove / 6;
    input[k++] = cell.isSecurityZone ? 1 : 0;
    input[k++] = (enemy.position.row - cell.row) / config.rows;
    input[k++] = (enemy.position.col - cell.col) / config.cols;
    return input;
}

// Cases accessibles, toujours dans le même ordre (ligne par ligne)
export const candidateCells = state => state.cells.flat().filter(c => c.isMovable);

/**
 * Agent qui se déplace avec un réseau de neurones (note de chaque case, la meilleure gagne).
 * @param {import('./NeuralNetwork.js').NeuralNetwork} network  réseau à une sortie
 */
export function createNeuralMoveAgent(network, { fightAgent = normalAgent, name = 'neural' } = {}) {
    return {
        name,
        chooseMove(state) {
            const cells = candidateCells(state);
            let best = null, bestScore = -Infinity;
            for (const cell of cells) {
                const score = network.forward(moveInputs(state, cell)).output[0];
                if (score > bestScore) { best = cell; bestScore = score; }
            }
            return best;
        },
        chooseFightAction: fightAgent.chooseFightAction,
    };
}
