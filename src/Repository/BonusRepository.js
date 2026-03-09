import { createBonus } from '../Models/Bonus.js';

const BONUS_DATA = [
    { name: 'PM +2',        type: 'move', amount: 2,   image: 'PM.png' },
    { name: 'PM +3',        type: 'move', amount: 3,   image: 'PM.png' },
    { name: 'Vie +30',      type: 'life', amount: 30,  image: 'life.png' },
    { name: 'Vie +50',      type: 'life', amount: 50,  image: 'life.png' },
    { name: 'Vie +100',     type: 'life', amount: 100, image: 'life.png' },
];

export class BonusRepository {
    static findAll() {
        return BONUS_DATA.map(d => createBonus(d.name, d.type, d.amount, d.image));
    }
}
