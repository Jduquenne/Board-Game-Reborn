import { normalAgent } from './ScriptedAgents.js';
import { MOVE_FEATURES, moveFeatures, moveContext, scoreCell } from './MoveFeatures.js';
import {
    weaponDamage, criticalChance, dodgeChance, healAmount, CRITICAL_MULTIPLIER, SPELL_COST, SUDDEN_DEATH_TURN,
} from '../Engine/Rules.js';

/*
 * Déplacement de l'IA Expert : les 9 caractéristiques du champion (MoveFeatures.js) + 4 nouvelles qui
 * tiennent compte de tout ce que le joueur voit depuis les lots de game design :
 *   - les dégâts « moyens » d'un coup : esquive de la cible, critiques de l'attaquant ;
 *   - la vie « effective » : les soins que le mana permet encore (Mages) ;
 *   - la mort subite : à partir du tour 80, celui qui a le plus de vie gagne s'il évite le combat.
 * Même règle d'équité : rien de caché (pas les pièges).
 */

const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

export const EXPERT_MOVE_FEATURES = Object.freeze([
    ...MOVE_FEATURES,
    { key: 'duelEdge',        label: 'Avantage moyen si je lance le duel' },
    { key: 'exposedEdge',     label: "Danger moyen s'il m'attaque" },
    { key: 'edgeDistance',    label: "Distance à l'ennemi × mon avantage" },
    { key: 'suddenDeathLead', label: 'Mort subite : distance × avance en vie' },
]);

// Dégâts moyens d'un coup de l'attaquant (avec l'arme donnée) sur la cible : esquive et critique compris
export function expectedDamage(attacker, target, weapon = attacker.weapon) {
    const critical = criticalChance(attacker, weapon);
    return weaponDamage(attacker, weapon) * (1 - dodgeChance(target)) * (1 + critical * (CRITICAL_MULTIPLIER - 1));
}

// Vie effective : la vie + la moitié des soins que le mana permet (un soin coûte une action)
export function effectiveHealth(player, health = player.health) {
    if (!player.intelligence) return health;
    const heals = Math.floor((player.mana ?? 0) / SPELL_COST);
    return health + heals * healAmount(player) / 2;
}

// Coups moyens nécessaires (nombre réel, pas arrondi)
const expectedHits = (health, damage) => clamp(health / Math.max(1, damage), 0.5, 10);

/**
 * Caractéristiques Expert d'une case accessible.
 * @returns {number[]} une valeur par entrée de EXPERT_MOVE_FEATURES
 */
export function expertMoveFeatures(state, cell, context = moveContext(state)) {
    const { me, enemy, norm } = context;

    // Moi après le déplacement (arme et bonus de vie éventuellement ramassés)
    const myWeapon = cell.weapon ?? me.player.weapon;
    const myHealth = me.player.health + (cell.bonus?.type === 'life' ? cell.bonus.amount : 0);

    const myHits    = expectedHits(effectiveHealth(enemy.player), expectedDamage(me.player, enemy.player, myWeapon));
    const enemyHits = expectedHits(effectiveHealth(me.player, myHealth), expectedDamage(enemy.player, me.player));

    // > 0 : je gagne l'échange de coups ; celui qui frappe en premier a une demi-frappe d'avance
    const duel     = cell.isSecurityZone ? 1 : 0;
    const exposed  = !duel && context.enemyReach.some(c => manhattan(c, cell) === 1) ? 1 : 0;
    const distance = manhattan(cell, enemy.position) / norm;
    const edge     = clamp((enemyHits - myHits) / 4, -1, 1);

    // Mort subite : 0 avant le tour 50, 1 au tour 80 ; avance en vie entre −1 et 1
    const lateness = clamp(((state.turn ?? 0) - (SUDDEN_DEATH_TURN - 30)) / 30, 0, 1);
    const lead     = clamp((myHealth - enemy.player.health) / 50, -1, 1);

    return [
        ...moveFeatures(state, cell, context),
        duel * clamp((enemyHits - myHits + 0.5) / 4, -1, 1),
        exposed * clamp((myHits - enemyHits + 0.5) / 4, -1, 1),
        distance * edge,
        distance * lateness * lead,
    ];
}

/**
 * Agent qui se déplace avec une fonction de score Expert.
 * @param {number[]} weights      un poids par caractéristique (EXPERT_MOVE_FEATURES)
 * @param {object} [fightAgent]   agent utilisé pour les combats (par défaut : règle de l'IA Normal)
 */
export function createExpertMoveAgent(weights, { fightAgent = normalAgent, name = 'expert' } = {}) {
    // Cases accessibles de la meilleure à la moins bonne (utilisé aussi par la recherche de l'IA Godlike)
    const rankMoves = state => {
        const cells = state.cells.flat().filter(c => c.isMovable);
        const context = moveContext(state);
        return cells
            .map(cell => ({ cell, score: scoreCell(weights, expertMoveFeatures(state, cell, context)) }))
            .sort((a, b) => b.score - a.score)
            .map(r => r.cell);
    };
    return {
        name,
        rankMoves,
        chooseMove: state => rankMoves(state)[0] ?? null,
        chooseFightAction: fightAgent.chooseFightAction,
    };
}
