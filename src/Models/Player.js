import { createWeapon } from './Weapon.js';

// Stats de combat (voir docs/spec-game-design.md) : 0 par défaut, elles n'ont alors aucun effet
//   strength     : Force — multiplie les dégâts de l'arme
//   agility      : Agilité — coups critiques et tacle (lot 2 / 3)
//   intelligence : Intelligence — mana pour les sorts (plus tard)
//   luck         : Chance — esquive et fuite (lot 2 / 3)
export const createPlayer = (name, health, image, maxMove, { strength = 0, agility = 0, intelligence = 0, luck = 0 } = {}) => ({
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
    isAI: false,
});
