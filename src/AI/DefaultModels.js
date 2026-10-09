/*
 * Modèles de référence livrés avec le jeu (pour qu'une leçon ait toujours un « maître » à imiter).
 *
 * CHAMPION_MOVE_WEIGHTS : poids du champion génétique de la Phase 7.3, obtenu avec
 *   node training/train-move.mjs --generations 25 --seed 1 --opponent normal   (2026-10-08)
 * → 71.8 % de victoires contre l'IA Normal sur les parties d'évaluation (graine 777).
 * Ordre des poids : MOVE_FEATURES (src/AI/MoveFeatures.js).
 */
export const CHAMPION_MOVE_WEIGHTS = Object.freeze([
    -0.015732261990577867,  // Case de duel
    1.7165984314800378,     // Avantage si je lance le duel
    1.7007244221323068,     // Gain d'arme
    0.5029591363243313,     // Bonus de vie
    -1.8170431671395393,    // Bonus de PM
    0.015146779493514034,   // Distance à l'ennemi
    0.1903192705529017,     // L'ennemi peut m'attaquer
    -2.1546654603834394,    // Danger s'il m'attaque
    -0.20664827058100496,   // Distance à une meilleure arme
]);

/*
 * EXPERT_MOVE_WEIGHTS : poids de l'IA Expert (caractéristiques EXPERT_MOVE_FEATURES, src/AI/ExpertMoveFeatures.js),
 * obtenus en deux étapes avec training/train-expert.mjs (2026-10-09) :
 *   1. depuis le champion, contre l'IA Difficile seule, 50 générations × 300 parties, graine 2 ;
 *   2. --start expert --generations 40 --games 200 --seed 3 (contre Difficile + Normal).
 * → 63.2 % contre l'IA Difficile, 68.3 % contre l'IA Normal (2 000 parties, graine 777).
 */
export const EXPERT_MOVE_WEIGHTS = Object.freeze([
    -0.3335744926100523,    // Case de duel
    3.8197600188452934,     // Avantage si je lance le duel
    2.8707204645199598,     // Gain d'arme
    2.642631881725794,      // Bonus de vie
    1.0060735881472058,     // Bonus de PM
    0.17181963134869077,    // Distance à l'ennemi
    -0.5152081270755908,    // L'ennemi peut m'attaquer
    -1.6200780485731376,    // Danger s'il m'attaque
    -0.6456859757206234,    // Distance à une meilleure arme
    -0.08526510111008748,   // Avantage moyen si je lance le duel
    -0.16156853051534206,   // Danger moyen s'il m'attaque
    -1.1022201287397162,    // Distance à l'ennemi × mon avantage
    3.3764426143125568,     // Mort subite : distance × avance en vie
]);
