import { createPlayer, CHARACTER_CLASS } from '../Models/Player.js';

const { BRUTE, ENT, THIEF, DUELLIST } = CHARACTER_CLASS;

/*
 * Modèles de classe (docs/spec-game-design.md §7) — même budget pour tous : Force + Agilité + Chance = 9.
 * Les PM dépendent de la classe ; les PV sont réglés par training/auto-balance.mjs.
 * Chaque personnage déplace ±1 point entre ses stats (tirage graine 2026) pour ne pas être le clone
 * des autres membres de sa classe.
 */
export const CLASS_TEMPLATES = Object.freeze({
    [BRUTE]:    { strength: 7, agility: 1, luck: 1, maxMove: 2 },
    [ENT]:      { strength: 2, agility: 6, luck: 1, maxMove: 2 },
    [THIEF]:    { strength: 1, agility: 2, luck: 6, maxMove: 5 },
    [DUELLIST]: { strength: 4, agility: 5, luck: 0, maxMove: 3 },
});
export const STAT_BUDGET = 9;

// Données brutes — ajouter un personnage ici suffit
const PLAYER_DATA = [
    { name: 'ElonMusk', characterClass: BRUTE, health: 100, image: 'ElonMusk.png', maxMove: 2, strength: 8, agility: 0, luck: 1 },
    { name: 'Indiana', characterClass: BRUTE, health: 100, image: 'Indiana.png', maxMove: 2, strength: 8, agility: 0, luck: 1 },
    { name: 'Yggdrassil', characterClass: BRUTE, health: 100, image: 'Yggdrassil.png', maxMove: 2, strength: 6, agility: 1, luck: 2 },
    { name: 'Khadgar', characterClass: BRUTE, health: 100, image: 'Khadgar.png', maxMove: 2, strength: 8, agility: 1, luck: 0 },
    { name: 'Xena', characterClass: ENT, health: 100, image: 'Xena.png', maxMove: 2, strength: 1, agility: 7, luck: 1 },
    { name: 'Björn', characterClass: ENT, health: 100, image: 'Björn.png', maxMove: 2, strength: 3, agility: 5, luck: 1 },
    { name: 'Brutus', characterClass: ENT, health: 100, image: 'Brutus.png', maxMove: 2, strength: 1, agility: 7, luck: 1 },
    { name: 'Gunnar', characterClass: ENT, health: 100, image: 'Gunnar.png', maxMove: 2, strength: 2, agility: 7, luck: 0 },
    { name: 'Prirodny', characterClass: THIEF, health: 100, image: 'Prirodny.png', maxMove: 5, strength: 0, agility: 2, luck: 7 },
    { name: 'Lancelot', characterClass: THIEF, health: 100, image: 'Lancelot.png', maxMove: 5, strength: 2, agility: 2, luck: 5 },
    { name: 'Bolvar', characterClass: THIEF, health: 100, image: 'Bolvar.png', maxMove: 5, strength: 0, agility: 3, luck: 6 },
    { name: 'Jail', characterClass: THIEF, health: 100, image: 'Jail.png', maxMove: 5, strength: 0, agility: 3, luck: 6 },
    { name: 'Thork', characterClass: DUELLIST, health: 100, image: 'Thork.png', maxMove: 3, strength: 3, agility: 5, luck: 1 },
    { name: 'Vanessa VanCleef', characterClass: DUELLIST, health: 100, image: 'Van_cleef.png', maxMove: 3, strength: 3, agility: 6, luck: 0 },
    { name: 'Kerhs', characterClass: DUELLIST, health: 100, image: 'Kerhs.png', maxMove: 3, strength: 4, agility: 4, luck: 1 },
];

export class PlayersRepository {
    // Retourne des instances fraîches à chaque appel (pas de partage de références)
    static findAll() {
        // Stats de combat facultatives (strength, agility, intelligence, luck) : 0 si absentes
        return PLAYER_DATA.map(d => createPlayer(d.name, d.health, d.image, d.maxMove, d));
    }
}
