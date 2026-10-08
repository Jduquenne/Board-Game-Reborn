import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { applyAttack, applyDefend, resolveRound } from './Rules.js';

// Délai en ms entre une action et la fin du round (laisse le temps d'afficher l'action)
const ROUND_DELAY = 500;

// Applique les règles de combat (Rules.js) au Store du jeu et émet les événements correspondants
class FightEngine {

    attack() {
        this.#act(applyAttack);
    }

    defend() {
        this.#act(applyDefend);
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #act(rule) {
        const before = store.state;
        if (!this.#commit(rule(before))) return;

        const { attackerIndex, targetIndex } = before.fight;
        setTimeout(() => this.#commit(resolveRound(store.state, attackerIndex, targetIndex)), ROUND_DELAY);
    }

    // Retourne false si l'action a été refusée par les règles
    #commit({ state, events }) {
        if (state === store.state) return false;
        store.setState(() => state);
        events.forEach(({ name, payload }) => eventBus.emit(name, payload));
        return true;
    }
}

export const fightEngine = new FightEngine();
