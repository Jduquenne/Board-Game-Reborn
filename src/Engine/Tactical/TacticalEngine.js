import { store } from '../../core/Store.js';
import { eventBus } from '../../core/EventBus.js';
import { createTacticalGame, applyMove, applyPunch, applyEndTurn } from './TacticalRules.js';

// Applique les règles du mode tactique (TacticalRules.js) à la clé `tactical` du Store et émet les événements
class TacticalEngine {

    start(options = {}) {
        store.setState(() => ({ phase: 'tactical', tactical: createTacticalGame(options) }));
        eventBus.emit('tactical:started');
    }

    move(cellId) {
        this.#commit(applyMove(store.state.tactical, cellId));
    }

    punch(cellId) {
        this.#commit(applyPunch(store.state.tactical, cellId));
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
