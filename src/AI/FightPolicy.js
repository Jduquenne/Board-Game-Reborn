import { normalAgent } from './ScriptedAgents.js';
import { weaponDamage } from '../Engine/Rules.js';

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
 *
 * Les coups sont comptés avec les dégâts réels de l'arme, Force comprise (sans la défense en cours,
 * qui est donnée à part). 10 × 10 × 2 × 2 = 400 situations possibles au maximum.
 */

export const FIGHT_ACTIONS = ['attack', 'defend'];

const MAX_HITS = 10;

const hitsToKill = (health, damage) => Math.min(MAX_HITS, Math.max(1, Math.ceil(health / damage)));

// Clé de situation du point de vue de l'attaquant (celui qui doit choisir) : "myHits|enemyHits|myDef|enemyDef"
export function fightStateKey(state) {
    const { players, fight } = state;
    const me    = players[fight.attackerIndex].player;
    const enemy = players[fight.targetIndex].player;

    return [
        hitsToKill(enemy.health, weaponDamage(me)),
        hitsToKill(me.health, weaponDamage(enemy)),
        me.defense ? 1 : 0,
        enemy.defense ? 1 : 0,
    ].join('|');
}

// Description lisible d'une clé, pour l'affichage (page d'entraînement)
export function describeFightKey(key) {
    const [myHits, enemyHits, myDef, enemyDef] = key.split('|').map(Number);
    const hits = n => (n >= MAX_HITS ? `${MAX_HITS}+ coups` : `${n} coup${n > 1 ? 's' : ''}`);
    return {
        myHits, enemyHits, myDefense: myDef === 1, enemyDefense: enemyDef === 1,
        text: `Je le tue en ${hits(myHits)}, il me tue en ${hits(enemyHits)}`
            + (myDef ? ' · je suis en défense' : '')
            + (enemyDef ? ' · il est en défense' : ''),
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
            const key = fightStateKey(state);
            return explore ? qtable.choose(key, rng) : qtable.best(key);
        },
    };
}
