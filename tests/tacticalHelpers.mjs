// Aides pour les tests du mode tactique : combat déjà commencé, personnages placés sur une zone dégagée du plateau
import { createTacticalGame, applyStart } from '../src/Engine/Tactical/TacticalRules.js';
import { cellAt } from '../src/Engine/Tactical/TacticalGrid.js';
import { createRng } from '../src/core/Random.js';

// Case de référence (16, 10) en coordonnées carrées : aucun bloc ni trou à moins de 5 pas
const BASE = { x: 16, y: 10 };

// id de la case décalée de (dx, dy) depuis la case de référence
export const at = (state, dx, dy) => cellAt(state.board, BASE.x + dx, BASE.y + dy).id;

/**
 * Combat commencé entre deux classes ; le joueur 1 joue en premier (initiative forcée).
 * @param {string[]} classes
 * @param {number[]} a  décalage [dx, dy] du joueur 1
 * @param {number[]} b  décalage [dx, dy] du joueur 2
 */
export function duel(classes, a, b) {
    const state = createTacticalGame({ classes }, createRng(1));
    const fighters = state.fighters.map((f, i) => ({
        ...f,
        cellId: at(state, ...(i === 0 ? a : b)),
        initiative: i === 0 ? 999 : 0,
    }));
    return applyStart({ ...state, fighters }, () => 0).state;
}

// Remplace des champs d'un personnage (sans recalculer les options : à utiliser avant une action)
export const withFighter = (state, index, change) => ({
    ...state,
    fighters: state.fighters.map((f, i) => i === index ? { ...f, ...change } : f),
});
