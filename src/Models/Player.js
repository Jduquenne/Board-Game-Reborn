import { createWeapon } from './Weapon.js';

// Classes de personnage (docs/spec-game-design.md §7)
export const CHARACTER_CLASS = Object.freeze({
    BRUTE: 'brute',
    ENT: 'ent',
    THIEF: 'thief',
    DUELLIST: 'duellist',
    MAGE: 'mage',
});

export const CHARACTER_CLASS_LABEL = Object.freeze({
    [CHARACTER_CLASS.BRUTE]: 'Brute',
    [CHARACTER_CLASS.ENT]: 'Ent',
    [CHARACTER_CLASS.THIEF]: 'Voleur',
    [CHARACTER_CLASS.DUELLIST]: 'Duelliste',
    [CHARACTER_CLASS.MAGE]: 'Mage',
});

// Mana (lot 8) : réserve maximale = Intelligence × 10, pleine au départ
export const MANA_PER_INTELLIGENCE = 10;

// Stats de combat (voir docs/spec-game-design.md) : 0 par défaut, elles n'ont alors aucun effet
//   strength     : Force — multiplie les dégâts de l'arme
//   agility      : Agilité — coups critiques et tacle (lot 2 / 3)
//   intelligence : Intelligence — mana pour les sorts (lot 8)
//   luck         : Chance — esquive et fuite (lot 2 / 3)
// characterClass : classe du personnage (CHARACTER_CLASS), null si aucune
export const createPlayer = (name, health, image, maxMove, { strength = 0, agility = 0, intelligence = 0, luck = 0, characterClass = null } = {}) => ({
    name,
    health,
    maxHealth: health,
    defense: false,
    weapon: createWeapon('Épée de boisaille', 10, 'basic_weapon.png'),
    image,
    maxMove,
    strength,
    agility,
    intelligence,
    luck,
    characterClass,
    mana: intelligence * MANA_PER_INTELLIGENCE,
    maxMana: intelligence * MANA_PER_INTELLIGENCE,
    rooted: 0,        // actions de combat restantes sous Entrave (ne peut pas fuir)
    isAI: false,
});
