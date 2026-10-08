import { GameEnv, DEFAULT_CONFIG } from './GameEnv.js';
import { createRng } from '../core/Random.js';

/*
 * Arène : fait s'affronter deux agents sur de nombreuses parties et mesure leur niveau.
 * C'est l'outil de base pour savoir si une IA progresse : on la compare toujours
 * à des références fixes (agents scriptés) sur les mêmes parties (même graine).
 */

/**
 * Joue une partie complète entre deux agents.
 * @param {[object, object]} agents  agents[0] joue le joueur 0 (qui commence), agents[1] le joueur 1
 * @returns {{ winner: 0 | 1 | null, turns: number }}  winner null = match nul (limite de tours)
 */
export function playGame(agents, { config = DEFAULT_CONFIG, rng = Math.random, maxTurns = 300 } = {}) {
    const env = new GameEnv({ config, rng, maxTurns });
    env.reset();

    while (!env.done) {
        const agent  = agents[env.currentPlayerIndex];
        const action = chooseAction(agent, env.state, rng);
        // Une action illégale ne fait pas avancer la partie : on arrête plutôt que de boucler
        if (!env.step(action).accepted) {
            throw new Error(`Agent "${agent.name}" chose an illegal action: ${JSON.stringify(action)}`);
        }
    }

    return { winner: env.winnerIndex, turns: env.turns };
}

/**
 * Match de plusieurs parties entre A et B. Les places sont alternées (A commence une partie sur deux)
 * pour ne pas avantager celui qui joue en premier.
 * @returns {{ games, winsA, winsB, draws, winRateA, avgTurns }}
 */
export function runMatch(agentA, agentB, { games = 100, seed = 1, config = DEFAULT_CONFIG, maxTurns = 300 } = {}) {
    const rng = createRng(seed);
    let winsA = 0, winsB = 0, draws = 0, totalTurns = 0;

    for (let g = 0; g < games; g++) {
        const aFirst = g % 2 === 0;
        const { winner, turns } = playGame(aFirst ? [agentA, agentB] : [agentB, agentA], { config, rng, maxTurns });
        totalTurns += turns;

        if (winner === null) draws++;
        else if ((winner === 0) === aFirst) winsA++;
        else winsB++;
    }

    return { games, winsA, winsB, draws, winRateA: winsA / games, avgTurns: totalTurns / games };
}

// Traduit le choix d'un agent en action pour l'environnement
export function chooseAction(agent, state, rng) {
    if (state.phase === 'fighting') return { type: agent.chooseFightAction(state, rng) };

    const move = agent.chooseMove(state, rng);
    return move ? { type: 'move', row: move.row, col: move.col } : { type: 'pass' };
}

/**
 * Partie pas à pas (générateur) entre deux agents, pour la regarder : rend l'état après chaque action.
 * La valeur de retour finale est { winner, turns }, comme playGame.
 */
export function* gameSteps(agents, { config = DEFAULT_CONFIG, rng = Math.random, maxTurns = 300 } = {}) {
    const env = new GameEnv({ config, rng, maxTurns });
    env.reset();
    yield { state: env.state };

    while (!env.done) {
        const actor  = env.currentPlayerIndex;
        const action = chooseAction(agents[actor], env.state, rng);
        if (!env.step(action).accepted) {
            throw new Error(`Agent "${agents[actor].name}" chose an illegal action: ${JSON.stringify(action)}`);
        }
        yield { state: env.state, actor, action };
    }

    return { winner: env.winnerIndex, turns: env.turns };
}
