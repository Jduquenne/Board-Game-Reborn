import { createWeapon } from '../Models/Weapon.js';

// Données brutes — ajouter une arme ici suffit
const WEAPON_DATA = [
    { name: 'Excalibur',             damage: 40, image: 'Excalibur.png' },
    { name: 'Deuilleombre',          damage: 40, image: 'Deuilleombre.png' },
    { name: 'Hurlesang',             damage: 35, image: 'Hurlesang.png' },
    { name: "Arc de Nodens",         damage: 35, image: 'Arc_de_Nodens.png' },
    { name: 'Marteau du destin',     damage: 30, image: 'Marteau_du_destin.png' },
    { name: 'Aiguille',              damage: 30, image: 'Aiguille.png' },
    { name: "Quel'delar",            damage: 25, image: 'Quel_delar.png' },
    { name: 'Lame du puits de soleil', damage: 25, image: 'Lame_du_puits_de soleil.png' },
    { name: 'Shuriken de Zorro',     damage: 20, image: 'Shuriken_de_Zorro.png' },
    { name: 'Gressil',               damage: 20, image: 'Gressil.png' },
    { name: 'Skyword',               damage: 15, image: 'Skyword.png' },
    { name: 'Firefox',               damage: 15, image: 'Firefox.png' },
];

export class WeaponsRepository {
    static findAll() {
        return WEAPON_DATA.map(d => createWeapon(d.name, d.damage, d.image));
    }
}
