import { getMovableCells } from '../Engine/MovementSystem.js';
import { normalAgent } from './ScriptedAgents.js';

/*
 * Déplacement par « fonction de score » : pour chaque case accessible, on calcule quelques
 * caractéristiques (features), chacune multipliée par un poids ; l'agent va sur la case
 * de plus grande note :   note(case) = Σ poids[i] × caractéristique[i](case)
 *
 * Les poids sont la « mémoire » de l'IA : ce sont eux que l'algorithme génétique fait évoluer.
 *
 * Règle d'équité : les caractéristiques n'utilisent que ce qu'un joueur voit à l'écran.
 * Les pièges non déclenchés sont cachés → on ne s'en sert jamais (sinon l'IA tricherait).
 */

// Ordre = ordre des poids dans un génome. label : affiché sur la page d'entraînement.
export const MOVE_FEATURES = Object.freeze([
    { key: 'duel',             label: 'Case de duel' },
    { key: 'duelAdvantage',    label: 'Avantage si je lance le duel' },
    { key: 'weaponGain',       label: "Gain d'arme" },
    { key: 'lifeBonus',        label: 'Bonus de vie' },
    { key: 'moveBonus',        label: 'Bonus de PM' },
    { key: 'distance',         label: "Distance à l'ennemi" },
    { key: 'exposed',          label: "L'ennemi peut m'attaquer" },
    { key: 'exposedDanger',    label: "Danger s'il m'attaque" },
    { key: 'betterWeaponDist', label: "Distance à une meilleure arme" },
]);

const MAX_HITS = 10;
const hitsToKill = (health, damage) => Math.min(MAX_HITS, Math.max(1, Math.ceil(health / damage)));
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

/**
 * Caractéristiques d'une case accessible, du point de vue du joueur actif.
 * @returns {number[]} une valeur par entrée de MOVE_FEATURES (environ entre −1 et 1)
 */
export function moveFeatures(state, cell, context = moveContext(state)) {
    const { me, enemy, enemyReach, betterWeapons, norm } = context;

    // Moi après le déplacement : arme et vie éventuellement ramassées (les pièges sont invisibles)
    const myDamage = cell.weapon ? cell.weapon.damage : me.player.weapon.damage;
    const myHealth = me.player.health + (cell.bonus?.type === 'life' ? cell.bonus.amount : 0);

    const myHits    = hitsToKill(enemy.player.health, myDamage);    // coups pour le tuer
    const enemyHits = hitsToKill(myHealth, enemy.player.weapon.damage); // coups pour me tuer

    // Duel lancé par moi : j'attaque en premier → je gagne si myHits ≤ enemyHits
    const duel = cell.isSecurityZone ? 1 : 0;
    const duelAdvantage = duel * clamp((enemyHits - myHits + 1) / 5, -1, 1);

    // Exposé : l'ennemi pourra s'arrêter à côté de moi au prochain tour et attaquer en premier
    const exposed = !duel && enemyReach.some(c => manhattan(c, cell) === 1) ? 1 : 0;
    const exposedDanger = exposed * clamp((myHits - enemyHits + 1) / 5, -1, 1);

    // Meilleure arme encore au sol (plus forte que celle que j'aurai), la plus proche
    const targets = betterWeapons.filter(w => w.weapon.damage > myDamage && (w.row !== cell.row || w.col !== cell.col));
    const betterWeaponDist = targets.length
        ? Math.min(...targets.map(w => manhattan(w, cell))) / norm
        : 1;

    return [
        duel,
        duelAdvantage,
        cell.weapon ? (cell.weapon.damage - me.player.weapon.damage) / 40 : 0,
        cell.bonus?.type === 'life' ? cell.bonus.amount / 100 : 0,
        cell.bonus?.type === 'move' ? cell.bonus.amount / 3 : 0,
        manhattan(cell, enemy.position) / norm,
        exposed,
        exposedDanger,
        betterWeaponDist,
    ];
}

// Calculs communs à toutes les cases d'un même tour (faits une seule fois)
export function moveContext(state) {
    const { players, activePlayerIndex, cells, config } = state;
    const me    = players[activePlayerIndex];
    const enemy = players[(activePlayerIndex + 1) % players.length];

    return {
        me,
        enemy,
        enemyReach: getMovableCells(enemy.position, enemy.player.maxMove, cells, config),
        betterWeapons: cells.flat().filter(c => c.weapon),
        norm: config.rows + config.cols,
    };
}

// Note d'une case : somme pondérée de ses caractéristiques
export function scoreCell(weights, features) {
    let score = 0;
    for (let i = 0; i < weights.length; i++) score += weights[i] * features[i];
    return score;
}

/**
 * Agent qui se déplace avec une fonction de score à poids.
 * @param {number[]} weights      un poids par caractéristique (MOVE_FEATURES)
 * @param {object} [fightAgent]   agent utilisé pour les combats (par défaut : règle de l'IA Normal)
 */
export function createWeightedMoveAgent(weights, { fightAgent = normalAgent, name = 'evolved' } = {}) {
    return {
        name,
        chooseMove(state) {
            const cells = state.cells.flat().filter(c => c.isMovable);
            if (cells.length === 0) return null;

            const context = moveContext(state);
            let best = null, bestScore = -Infinity;
            for (const cell of cells) {
                const score = scoreCell(weights, moveFeatures(state, cell, context));
                if (score > bestScore) { best = cell; bestScore = score; }
            }
            return best;
        },
        chooseFightAction: fightAgent.chooseFightAction,
    };
}
