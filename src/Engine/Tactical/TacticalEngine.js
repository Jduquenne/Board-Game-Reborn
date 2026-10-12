import { store } from '../../core/Store.js';
import { eventBus } from '../../core/EventBus.js';
import { createTacticalGame, applyPlace, applyStart, applyMove, applyCast, applyEndTurn } from './TacticalRules.js';

// Applique les règles du mode tactique (TacticalRules.js) à la clé `tactical` du Store et émet les événements
class TacticalEngine {

    // options : { classes: [classe du joueur 1, classe du joueur 2], mapId }
    start(options = {}) {
        store.setState(() => ({ phase: 'tactical', tactical: createTacticalGame(options) }));
        eventBus.emit('tactical:started');
    }

    place(cellId) {
        this.#commit(applyPlace(store.state.tactical, cellId));
    }

    ready() {
        this.#commit(applyStart(store.state.tactical));
    }

    move(cellId) {
        this.#commit(applyMove(store.state.tactical, cellId));
    }

    cast(spellId, cellId) {
        this.#commit(applyCast(store.state.tactical, spellId, cellId));
    }

    endTurn() {
        this.#commit(applyEndTurn(store.state.tactical));
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #commit({ state, events }) {
        if (state === store.state.tactical) return; // action refusée par les règles
        store.setState(() => ({ tactical: state }));
        events.forEach(({ name, payload }) => eventBus.emit(name, payload));
    }
}

export const tacticalEngine = new TacticalEngine();
