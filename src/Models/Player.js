import { createWeapon } from './Weapon.js';

export const createPlayer = (name, health, image, maxMove) => ({
    name,
    health,
    maxHealth: health,
    defense: false,
    weapon: createWeapon('Épée de boisaille', 10, 'basic_weapon.png'),
    image,
    maxMove,
    isAI: false,
});
