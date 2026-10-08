/*
 * Agents « scriptés » : des IA dont le comportement est écrit à la main (règles fixes).
 * Elles servent d'adversaires et de références pour mesurer les IA entraînées.
 *
 * Interface commune d'un agent (aucun effet de bord, l'agent ne fait que choisir) :
 *   name                              : identifiant court
 *   chooseMove(state, rng)            : { row, col } parmi les cases isMovable, ou null si aucune
 *   chooseFightAction(state, rng)     : 'attack' | 'defend' | 'flee' (fuite : seulement si fleeDestination existe)
 * L'agent joue toujours le joueur dont c'est le tour :
 *   state.activePlayerIndex en déplacement, state.fight.attackerIndex en combat.
 * rng : fonction aléatoire compatible Math.random (graine possible, voir core/Random.js).
 */

import { weaponDamage, fleeChance, fleeDestination } from '../Engine/Rules.js';

// Mode facile : probabilité d'attaquer plutôt que de se défendre
const EASY_ATTACK_CHANCE = 0.7;

const movableCells = state => state.cells.flat().filter(c => c.isMovable);
const pick = (list, rng) => list[Math.floor(rng() * list.length)];

// Aléatoire : déplacement et combat au hasard (référence la plus basse)
export const randomAgent = {
    name: 'random',
    chooseMove(state, rng) {
        const cells = movableCells(state);
        return cells.length ? pick(cells, rng) : null;
    },
    chooseFightAction(state, rng) {
        return rng() < 0.5 ? 'attack' : 'defend';
    },
};

// Facile : déplacement au hasard, attaque 70 % du temps
export const easyAgent = {
    name: 'easy',
    chooseMove: randomAgent.chooseMove,
    chooseFightAction(state, rng) {
        return rng() < EASY_ATTACK_CHANCE ? 'attack' : 'defend';
    },
};

// Normal : arbre de décision par ordre de priorité
export const normalAgent = {
    name: 'normal',

    chooseMove(state) {
        const cells = movableCells(state);
        if (cells.length === 0) return null;

        const { players, activePlayerIndex } = state;
        const me    = players[activePlayerIndex];
        const enemy = players[(activePlayerIndex + 1) % players.length];

        // Priorité 1 : déclencher un combat si on est avantagé
        // (on fait plus de dégâts OU on a plus de HP que l'adversaire)
        const fightCells = cells.filter(c => c.isSecurityZone);
        if (fightCells.length > 0) {
            const weHaveEdge =
                weaponDamage(me.player) >= weaponDamage(enemy.player) ||
                me.player.health > enemy.player.health;

            if (weHaveEdge) return closestTo(fightCells, enemy.position);
        }

        // Priorité 2 : ramasser une arme meilleure que celle qu'on porte
        // (parmi elles, celle qui nous rapproche le plus de l'ennemi)
        const weaponCells = cells.filter(c => c.weapon && weaponDamage(me.player, c.weapon) > weaponDamage(me.player));
        if (weaponCells.length > 0) return closestTo(weaponCells, enemy.position);

        // Priorité 3 : ramasser un bonus (vie ou PM)
        const bonusCells = cells.filter(c => c.bonus);
        if (bonusCells.length > 0) return closestTo(bonusCells, enemy.position);

        // Priorité 4 : se rapprocher de l'ennemi
        return closestTo(cells, enemy.position);
    },

    chooseFightAction(state) {
        const { players, fight } = state;
        const me    = players[fight.attackerIndex].player;
        const enemy = players[fight.targetIndex].player;

        // Priorité 1 : achever l'adversaire si notre coup suffit (sa défense divise par 2)
        const myDamage = enemy.defense ? Math.floor(weaponDamage(me) / 2) : weaponDamage(me);
        if (myDamage >= enemy.health) return 'attack';

        // Priorité 2 : le prochain coup adverse peut nous tuer
        //   → fuir si on a au moins une chance sur deux et une case de repli,
        //   → sinon se défendre (inutile si on est déjà en défense : le bonus ne se cumule pas)
        if (weaponDamage(enemy) >= me.health) {
            if (fleeChance(me, enemy) >= 0.5 && fleeDestination(state)) return 'flee';
            if (!me.defense) return 'defend';
        }

        // Priorité 3 : attaquer
        return 'attack';
    },
};

export const SCRIPTED_AGENTS = { random: randomAgent, easy: easyAgent, normal: normalAgent };

// Retourne la cellule de la liste la plus proche de targetPosition
// Utilise la distance de Manhattan : |Δrow| + |Δcol|
function closestTo(cells, targetPosition) {
    return cells.reduce((best, cell) => {
        const dBest = Math.abs(best.row - targetPosition.row) + Math.abs(best.col - targetPosition.col);
        const dCell = Math.abs(cell.row - targetPosition.row) + Math.abs(cell.col - targetPosition.col);
        return dCell < dBest ? cell : best;
    });
}
