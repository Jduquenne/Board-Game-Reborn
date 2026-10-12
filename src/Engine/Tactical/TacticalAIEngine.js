import { store } from '../../core/Store.js';
import { eventBus } from '../../core/EventBus.js';
import { TACTICAL_AGENTS } from '../../AI/Tactical/TacticalAgents.js';
import { tacticalEngine } from './TacticalEngine.js';

// Délais pour que le joueur humain voie ce que fait l'IA
const FIRST_ACTION_DELAY = 800;
const ACTION_DELAY = 650;
const MAX_ACTIONS_PER_TURN = 40;

/*
 * Fait jouer les personnages du mode tactique contrôlés par une IA (fighter.controller, docs/spec-tactical.md §9) :
 * placement dès le début du combat, puis une action à la fois pendant son tour, via tacticalEngine
 * (comme un joueur humain).
 */
class TacticalAIEngine {
    #unsubscribes = [];
    #timer = null;
    #actions = 0;

    start() {
        this.stop();
        this.#unsubscribes = [
            eventBus.on('tactical:started', () => this.#place()),
            eventBus.on('tactical:turn', () => this.#schedule(FIRST_ACTION_DELAY, true)),
            eventBus.on('tactical:over', () => this.#cancel()),
        ];
    }

    stop() {
        this.#unsubscribes.forEach(unsubscribe => unsubscribe());
        this.#unsubscribes = [];
        this.#cancel();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #agent(fighter) {
        return TACTICAL_AGENTS[fighter?.controller] ?? null;
    }

    #place() {
        const state = store.state.tactical;
        state.fighters.forEach((fighter, index) => {
            const agent = this.#agent(fighter);
            if (agent) tacticalEngine.place(agent.choosePlacement(store.state.tactical, index, Math.random));
        });
    }

    #schedule(delay, newTurn = false) {
        this.#cancel();
        if (newTurn) this.#actions = 0;
        const state = store.state.tactical;
        if (state?.phase !== 'fighting' || !this.#agent(state.fighters[state.activeIndex])) return;
        this.#timer = setTimeout(() => this.#step(), delay);
    }

    #step() {
        this.#timer = null;
        const state = store.state.tactical;
        if (state?.phase !== 'fighting') return;
        const index = state.activeIndex;
        const agent = this.#agent(state.fighters[index]);
        if (!agent) return;

        const action = this.#actions++ >= MAX_ACTIONS_PER_TURN ? { type: 'end' } : agent.chooseAction(state, index, Math.random);
        if (action.type === 'move') tacticalEngine.move(action.cellId);
        if (action.type === 'cast') tacticalEngine.cast(action.spellId, action.cellId);

        // Fin du tour demandée, ou action refusée par les règles : le tour passe (tactical:turn relance l'IA si besoin)
        if (action.type === 'end' || store.state.tactical === state) {
            tacticalEngine.endTurn();
            return;
        }
        this.#schedule(ACTION_DELAY);
    }

    #cancel() {
        clearTimeout(this.#timer);
        this.#timer = null;
    }
}

export const tacticalAIEngine = new TacticalAIEngine();
