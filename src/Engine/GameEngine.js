import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { createGame, applyMove, skipIfBlocked } from './Rules.js';

// Applique les règles pures (Rules.js) au Store du jeu et émet les événements correspondants
class GameEngine {

    startGame(config) {
        store.setState(() => createGame(config));
        eventBus.emit('game:started');

        // Rare : le premier joueur n'a aucune case accessible → il passe son tour
        this.#commit(skipIfBlocked(store.state));
    }

    movePlayer(targetRow, targetCol) {
        this.#commit(applyMove(store.state, targetRow, targetCol));
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #commit({ state, events }) {
        if (state === store.state) return; // action refusée par les règles
        store.setState(() => state);
        events.forEach(({ name, payload }) => eventBus.emit(name, payload));
    }
}

export const gameEngine = new GameEngine();
