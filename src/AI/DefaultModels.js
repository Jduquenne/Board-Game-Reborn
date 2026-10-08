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
