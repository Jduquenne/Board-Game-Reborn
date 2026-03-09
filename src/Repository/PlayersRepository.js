import { createPlayer } from '../Models/Player.js';

// Données brutes — ajouter un personnage ici suffit
const PLAYER_DATA = [
    { name: 'Björn',           health: 100, image: 'Björn.png',      maxMove: 3 },
    { name: 'Bolvar',          health: 150, image: 'Bolvar.png',      maxMove: 2 },
    { name: 'Brutus',          health: 75,  image: 'Brutus.png',      maxMove: 4 },
    { name: 'ElonMusk',        health: 100, image: 'ElonMusk.png',    maxMove: 3 },
    { name: 'Gunnar',          health: 75,  image: 'Gunnar.png',      maxMove: 4 },
    { name: 'Indiana',         health: 70,  image: 'Indiana.png',     maxMove: 5 },
    { name: 'Jail',            health: 100, image: 'Jail.png',        maxMove: 3 },
    { name: 'Kerhs',           health: 100, image: 'Kerhs.png',       maxMove: 5 },
    { name: 'Khadgar',         health: 100, image: 'Khadgar.png',     maxMove: 3 },
    { name: 'Lancelot',        health: 100, image: 'Lancelot.png',    maxMove: 4 },
    { name: 'Prirodny',        health: 100, image: 'Prirodny.png',    maxMove: 3 },
    { name: 'Thork',           health: 100, image: 'Thork.png',       maxMove: 2 },
    { name: 'Vanessa VanCleef',health: 100, image: 'Van_cleef.png',   maxMove: 3 },
    { name: 'Xena',            health: 300, image: 'Xena.png',        maxMove: 1 },
    { name: 'Yggdrassil',      health: 100, image: 'Yggdrassil.png',  maxMove: 3 },
];

export class PlayersRepository {
    // Retourne des instances fraîches à chaque appel (pas de partage de références)
    static findAll() {
        return PLAYER_DATA.map(d => createPlayer(d.name, d.health, d.image, d.maxMove));
    }
}
