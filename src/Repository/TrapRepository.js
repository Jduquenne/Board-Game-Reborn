import { createTrap } from '../Models/Trap.js';

const TRAP_DATA = [
    { name: 'trap1', image: 'trap1.png' },
    { name: 'trap2', image: 'trap1.png' },
    { name: 'trap3', image: 'trap1.png' },
    { name: 'trap4', image: 'trap1.png' },
    { name: 'trap5', image: 'trap1.png' },
];

export class TrapRepository {
    static findAll() {
        return TRAP_DATA.map(d => createTrap(d.name, d.image));
    }
}
