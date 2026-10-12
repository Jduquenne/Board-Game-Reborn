/*
 * Combats complets entre deux agents du mode tactique, sans délai (arène, mesures d'équilibre, tests).
 * Même graine → mêmes combats.
 */
import { createTacticalGame } from '../../Engine/Tactical/TacticalRules.js';
import { applyAction, END } from './TacticalAgents.js';

export const MAX_TURNS = 200;           // filet de sécurité : la mort subite termine les combats bien avant
const MAX_ACTIONS_PER_TURN = 40;        // un agent qui ne finit pas son tour est arrêté

/**
 * @param {{ classes: string[], agents: object[], rng: () => number }} options  agents des joueurs 1 et 2
 * @returns {{ winnerIndex: number | null, firstIndex: number, turns: number }}  winnerIndex null = nul (MAX_TURNS)
 */
export function playTacticalFight({ classes, agents, rng }) {
    let state = createTacticalGame({ classes, controllers: agents.map(a => a.name) }, rng);

    for (const index of [0, 1]) {
        state = applyAction(state, { type: 'place', cellId: agents[index].choosePlacement(state, index, rng) }).state;
    }
    state = applyAction(state, { type: 'ready' }, rng).state;
    const firstIndex = state.activeIndex;

    let actions = 0;
    while (state.phase === 'fighting' && state.turn <= MAX_TURNS) {
        const index = state.activeIndex;
        const action = actions >= MAX_ACTIONS_PER_TURN ? END : agents[index].chooseAction(state, index, rng);
        const { state: next } = applyAction(state, action, rng);
        if (next === state) throw new Error(`Action refusée par les règles (${agents[index].name}) : ${JSON.stringify(action)}`);
        actions = action.type === 'end' ? 0 : actions + 1;
        state = next;
    }

    return { winnerIndex: state.winnerIndex, firstIndex, turns: state.turn };
}
