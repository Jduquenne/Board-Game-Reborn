import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { applyAttack, applyDefend, applyFlee, applySpell, resolveRound, markEscapeCells, clearEscapeCells } from './Rules.js';

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

    // Sort (lot 8) : 'heal' (Soin) ou 'root' (Entrave), à la place de l'action du round
    castSpell(spell) {
        this.#act(state => applySpell(state, spell));
    }

    // Fuite vers la case choisie { row, col } (joueur), ou vers la plus éloignée sans argument (IA)
    flee(target = null) {
        this.#act(state => applyFlee(state, Math.random, target));
    }

    // Choix de la fuite (joueur humain) : affiche les cases de repli sur le plateau / les retire
    startFleeSelection() {
        return this.#commit(markEscapeCells(store.state));
    }

    cancelFleeSelection() {
        this.#commit(clearEscapeCells(store.state));
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #act(rule) {
        const before = store.state;
        if (!this.#commit(rule(before))) return;
        if (store.state.phase !== 'fighting') return; // fuite réussie : le combat est terminé

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
