import { createWeapon, WEAPON_TYPE } from '../Models/Weapon.js';

const { HEAVY, LIGHT, BALANCED } = WEAPON_TYPE;

// Données brutes — ajouter une arme ici suffit (type : premier jet, à ajuster)
const WEAPON_DATA = [
    { name: 'Excalibur',             damage: 40, image: 'Excalibur.png',              type: HEAVY },
    { name: 'Deuilleombre',          damage: 40, image: 'Deuilleombre.png',           type: LIGHT },
    { name: 'Hurlesang',             damage: 35, image: 'Hurlesang.png',              type: HEAVY },
    { name: "Arc de Nodens",         damage: 35, image: 'Arc_de_Nodens.png',          type: BALANCED },
    { name: 'Marteau du destin',     damage: 30, image: 'Marteau_du_destin.png',      type: HEAVY },
    { name: 'Aiguille',              damage: 30, image: 'Aiguille.png',               type: LIGHT },
    { name: "Quel'delar",            damage: 25, image: 'Quel_delar.png',             type: BALANCED },
    { name: 'Lame du puits de soleil', damage: 25, image: 'Lame_du_puits_de soleil.png', type: BALANCED },
    { name: 'Shuriken de Zorro',     damage: 20, image: 'Shuriken_de_Zorro.png',      type: LIGHT },
    { name: 'Gressil',               damage: 20, image: 'Gressil.png',                type: BALANCED },
    { name: 'Skyword',               damage: 15, image: 'Skyword.png',                type: HEAVY },
    { name: 'Firefox',               damage: 15, image: 'Firefox.png',                type: LIGHT },
];

export class WeaponsRepository {
    static findAll() {
        return WEAPON_DATA.map(d => createWeapon(d.name, d.damage, d.image, d.type));
    }
}
