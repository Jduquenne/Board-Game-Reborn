import { createPlayer, CHARACTER_CLASS } from '../Models/Player.js';

const { BRUTE, ENT, THIEF, DUELLIST, MAGE } = CHARACTER_CLASS;

/*
 * Modèles de classe (docs/spec-game-design.md §7) — même budget pour tous : Force + Agilité + Intelligence + Chance = 9.
 * Les PM dépendent de la classe ; les PV sont réglés par training/auto-balance.mjs (appliqués le 2026-10-09).
 * Chaque personnage déplace ±1 point entre ses stats (tirage graine 2026) pour ne pas être le clone
 * des autres membres de sa classe.
 */
export const CLASS_TEMPLATES = Object.freeze({
    [BRUTE]:    { strength: 7, agility: 1, intelligence: 0, luck: 1, maxMove: 2 },
    [ENT]:      { strength: 2, agility: 6, intelligence: 0, luck: 1, maxMove: 2 },
    [THIEF]:    { strength: 1, agility: 2, intelligence: 0, luck: 6, maxMove: 5 },
    [DUELLIST]: { strength: 4, agility: 5, intelligence: 0, luck: 0, maxMove: 3 },
    [MAGE]:     { strength: 1, agility: 1, intelligence: 6, luck: 1, maxMove: 3 }, // lot 8 : sorts
});
export const STAT_BUDGET = 9;

// Données brutes — ajouter un personnage ici suffit
const PLAYER_DATA = [
    { name: 'ElonMusk', characterClass: BRUTE, health: 100, image: 'ElonMusk.png', maxMove: 2, strength: 8, agility: 0, luck: 1 },
    { name: 'Indiana', characterClass: BRUTE, health: 101, image: 'Indiana.png', maxMove: 2, strength: 8, agility: 0, luck: 1 },
    { name: 'Yggdrassil', characterClass: BRUTE, health: 101, image: 'Yggdrassil.png', maxMove: 2, strength: 6, agility: 1, luck: 2 },
    { name: 'Khadgar', characterClass: MAGE, health: 100, image: 'Khadgar.png', maxMove: 3, strength: 1, agility: 0, intelligence: 7, luck: 1 },
    { name: 'Xena', characterClass: ENT, health: 113, image: 'Xena.png', maxMove: 2, strength: 1, agility: 7, luck: 1 },
    { name: 'Björn', characterClass: ENT, health: 106, image: 'Björn.png', maxMove: 2, strength: 3, agility: 5, luck: 1 },
    { name: 'Brutus', characterClass: ENT, health: 113, image: 'Brutus.png', maxMove: 2, strength: 1, agility: 7, luck: 1 },
    { name: 'Gunnar', characterClass: MAGE, health: 100, image: 'Gunnar.png', maxMove: 3, strength: 2, agility: 1, intelligence: 5, luck: 1 },
    { name: 'Prirodny', characterClass: THIEF, health: 91, image: 'Prirodny.png', maxMove: 5, strength: 0, agility: 2, luck: 7 },
    { name: 'Lancelot', characterClass: THIEF, health: 95, image: 'Lancelot.png', maxMove: 5, strength: 2, agility: 2, luck: 5 },
    { name: 'Bolvar', characterClass: THIEF, health: 96, image: 'Bolvar.png', maxMove: 5, strength: 0, agility: 3, luck: 6 },
    { name: 'Jail', characterClass: MAGE, health: 100, image: 'Jail.png', maxMove: 3, strength: 0, agility: 1, intelligence: 7, luck: 1 },
    { name: 'Thork', characterClass: DUELLIST, health: 101, image: 'Thork.png', maxMove: 3, strength: 3, agility: 5, luck: 1 },
    { name: 'Vanessa VanCleef', characterClass: DUELLIST, health: 101, image: 'Van_cleef.png', maxMove: 3, strength: 3, agility: 6, luck: 0 },
    { name: 'Kerhs', characterClass: DUELLIST, health: 102, image: 'Kerhs.png', maxMove: 3, strength: 4, agility: 4, luck: 1 },
];

export class PlayersRepository {
    // Retourne des instances fraîches à chaque appel (pas de partage de références)
    static findAll() {
        // Stats de combat facultatives (strength, agility, intelligence, luck) : 0 si absentes
        return PLAYER_DATA.map(d => createPlayer(d.name, d.health, d.image, d.maxMove, d));
    }
}
