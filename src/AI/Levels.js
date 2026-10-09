import { createWeightedMoveAgent } from './MoveFeatures.js';
import { createExpertMoveAgent } from './ExpertMoveFeatures.js';
import { createSearchAgent } from './SearchAgent.js';
import { CHAMPION_MOVE_WEIGHTS, EXPERT_MOVE_WEIGHTS } from './DefaultModels.js';

/*
 * Niveaux d'IA au-delà de l'IA Normal (choisis dans les Paramètres) :
 *   - Difficile : le champion génétique (déplacement appris, combat de l'IA Normal) ;
 *   - Expert    : déplacement réentraîné avec plus d'informations (ExpertMoveFeatures.js) ;
 *   - Godlike   : l'Expert qui réfléchit avant chaque coup (recherche Monte-Carlo, SearchAgent.js).
 * Aucun ne triche : ils ne voient que ce qu'un joueur voit à l'écran.
 */
const hard   = createWeightedMoveAgent(CHAMPION_MOVE_WEIGHTS, { name: 'hard' });
const expert = createExpertMoveAgent(EXPERT_MOVE_WEIGHTS, { name: 'expert' });

export const AI_LEVELS = Object.freeze({
    hard,
    expert,
    godlike: createSearchAgent(expert, { name: 'godlike' }),
});
