import { eventBus } from './EventBus.js';

const createInitialState = () => ({
    phase: 'menu', // 'menu' | 'playing' | 'fighting' | 'gameover'
    config: {
        rows: 10,
        cols: 10,
        nbObstacles: 10,
        nbWeapons: 3,
        nbBonus: 3,
        nbTraps: 3,
    },
    cells: [],   // Cell[][]
    players: [], // PlayerInfo[]  { player, position: { row, col } }
    activePlayerIndex: 0,
    fight: null, // { attackerIndex, targetIndex } | null
});

class Store {
    #state = createInitialState();

    get state() {
        return this.#state;
    }

    setState(updater) {
        this.#state = { ...this.#state, ...updater(this.#state) };
        eventBus.emit('state:changed', this.#state);
    }

    reset() {
        this.#state = createInitialState();
        eventBus.emit('state:changed', this.#state);
    }
}

export const store = new Store();
