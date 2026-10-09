import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { createGame, applyMove, skipIfBlocked, initiative } from './Rules.js';

// Applique les règles pures (Rules.js) au Store du jeu et émet les événements correspondants
class GameEngine {

    startGame(config) {
        store.setState(() => createGame(config));
        eventBus.emit('game:started');

        // Le personnage qui a la plus haute initiative commence (peut être l'IA)
        const { players, activePlayerIndex } = store.state;
        eventBus.emit('game:initiative', {
            playerInfo: players[activePlayerIndex],
            initiatives: players.map(p => initiative(p.player)),
        });

        // Rare : le premier joueur n'a aucune case accessible → il passe son tour
        const skipped = skipIfBlocked(store.state);
        if (skipped.state !== store.state) this.#commit(skipped);
        else eventBus.emit('turn:changed', { activePlayerIndex }); // l'IA joue si elle commence
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
