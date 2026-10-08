import { createPlayer } from '../Models/Player.js';

// Données brutes — ajouter un personnage ici suffit
const PLAYER_DATA = [
    { name: 'Björn', health: 105, image: 'Björn.png', maxMove: 1, strength: 5 },
    { name: 'Bolvar', health: 100, image: 'Bolvar.png', maxMove: 2, strength: 5 },
    { name: 'Brutus', health: 97, image: 'Brutus.png', maxMove: 3, strength: 5 },
    { name: 'ElonMusk', health: 95, image: 'ElonMusk.png', maxMove: 4, strength: 5 },
    { name: 'Gunnar', health: 96, image: 'Gunnar.png', maxMove: 5, strength: 5 },
    { name: 'Indiana', health: 110, image: 'Indiana.png', maxMove: 1, strength: 4 },
    { name: 'Jail', health: 107, image: 'Jail.png', maxMove: 2, strength: 4 },
    { name: 'Kerhs', health: 104, image: 'Kerhs.png', maxMove: 3, strength: 4 },
    { name: 'Khadgar', health: 103, image: 'Khadgar.png', maxMove: 4, strength: 4 },
    { name: 'Lancelot', health: 97, image: 'Lancelot.png', maxMove: 5, strength: 4 },
    { name: 'Prirodny', health: 109, image: 'Prirodny.png', maxMove: 1, strength: 3 },
    { name: 'Thork', health: 105, image: 'Thork.png', maxMove: 2, strength: 3 },
    { name: 'Vanessa VanCleef', health: 104, image: 'Van_cleef.png', maxMove: 3, strength: 3 },
    { name: 'Xena', health: 103, image: 'Xena.png', maxMove: 4, strength: 3 },
    { name: 'Yggdrassil', health: 97, image: 'Yggdrassil.png', maxMove: 5, strength: 3 },
];



export class PlayersRepository {
    // Retourne des instances fraîches à chaque appel (pas de partage de références)
    static findAll() {
        // Stats de combat facultatives (strength, agility, intelligence, luck) : 0 si absentes
        return PLAYER_DATA.map(d => createPlayer(d.name, d.health, d.image, d.maxMove, d));
    }
}
