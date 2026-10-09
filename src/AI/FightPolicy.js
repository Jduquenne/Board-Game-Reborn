import { normalAgent } from './ScriptedAgents.js';
import { weaponDamage, fleeChance, fleeDestination, castableSpells } from '../Engine/Rules.js';

/*
 * Ce que l'IA « voit » d'un combat pour décider entre attaquer et se défendre.
 *
 * L'état complet (PV exacts, armes, plateau…) est trop détaillé : la table Q serait immense et
 * l'IA reverrait rarement deux fois la même situation. On le résume donc en quelques nombres
 * qui comptent vraiment pour décider — c'est l'« observation » (ou les « features ») :
 *
 *   - combien de coups il me faut pour tuer l'adversaire (1 à 10, « 10 » = 10 ou plus) ;
 *   - combien de coups il lui faut pour me tuer ;
 *   - suis-je en défense ? est-il en défense ?
 *   - puis-je fuir, et avec quelle chance (en dixièmes) ?
 *
 * Les coups sont comptés avec les dégâts réels de l'arme, Force comprise (sans la défense en cours,
 * qui est donnée à part). 10 × 10 × 2 × 2 × 11 = 4 400 situations possibles au maximum (en pratique bien moins).
 */

export const FIGHT_ACTIONS = ['attack', 'defend', 'flee'];

// Actions possibles : pas de fuite sans case de repli (Rules.fleeDestination) ; sorts selon le mana (lot 8).
// La table Q ne connaît pas les sorts (FIGHT_ACTIONS) : ses agents filtrent sur leurs propres actions.
export const allowedFightActions = state => [
    ...(fleeDestination(state) ? FIGHT_ACTIONS : ['attack', 'defend']),
    ...castableSpells(state),
];

const MAX_HITS = 10;

const hitsToKill = (health, damage) => Math.min(MAX_HITS, Math.max(1, Math.ceil(health / damage)));

// Clé de situation du point de vue de l'attaquant (celui qui doit choisir) :
// "myHits|enemyHits|myDef|enemyDef|flee" — flee = chance de fuir en dixièmes (0 à 9), « x » si impossible
export function fightStateKey(state) {
    const { players, fight } = state;
    const me    = players[fight.attackerIndex].player;
    const enemy = players[fight.targetIndex].player;

    return [
        hitsToKill(enemy.health, weaponDamage(me)),
        hitsToKill(me.health, weaponDamage(enemy)),
        me.defense ? 1 : 0,
        enemy.defense ? 1 : 0,
        fleeDestination(state) ? Math.round(fleeChance(me, enemy) * 10) : 'x',
    ].join('|');
}

// Description lisible d'une clé, pour l'affichage (page d'entraînement)
export function describeFightKey(key) {
    const [myHits, enemyHits, myDef, enemyDef] = key.split('|').map(Number);
    const flee = key.split('|')[4];
    const canFlee = flee !== undefined && flee !== 'x';
    const hits = n => (n >= MAX_HITS ? `${MAX_HITS}+ coups` : `${n} coup${n > 1 ? 's' : ''}`);
    return {
        myHits, enemyHits, myDefense: myDef === 1, enemyDefense: enemyDef === 1, canFlee,
        text: `Je le tue en ${hits(myHits)}, il me tue en ${hits(enemyHits)}`
            + (myDef ? ' · je suis en défense' : '')
            + (enemyDef ? ' · il est en défense' : '')
            + (canFlee ? ` · fuite possible (${Number(flee) * 10} %)` : ' · fuite impossible'),
    };
}

/**
 * Agent qui se déplace comme l'IA « normale » et combat avec une table Q.
 * @param {import('./QLearning.js').QTable} qtable
 * @param {object} [options]
 * @param {boolean} [options.explore=false]  true pendant l'entraînement (epsilon-greedy), false pour jouer
 */
export function createQFightAgent(qtable, { explore = false, name = 'trained' } = {}) {
    return {
        name,
        chooseMove: normalAgent.chooseMove,
        chooseFightAction(state, rng) {
            const key     = fightStateKey(state);
            const allowed = allowedFightActions(state).filter(a => qtable.actions.includes(a)); // anciens modèles : sans fuite
            return explore ? qtable.choose(key, rng, allowed) : qtable.best(key, allowed);
        },
    };
}
