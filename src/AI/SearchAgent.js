import { GameEnv } from './GameEnv.js';
import { chooseAction } from './Arena.js';
import { allowedFightActions } from './FightPolicy.js';
import { createRng } from '../core/Random.js';
import { DECOR } from '../Models/Cell.js';

/*
 * Recherche Monte-Carlo (IA Godlike) : « réfléchir avant de jouer ».
 *
 * Pour chaque coup possible, l'IA imagine plusieurs fins de partie (des « simulations » ou rollouts) :
 * elle joue le coup, puis laisse une stratégie de base (l'IA Expert) jouer les deux camps jusqu'au bout.
 * Le coup qui gagne le plus souvent dans ces parties imaginées est joué pour de vrai.
 * C'est l'idée de la recherche d'AlphaGo (en plus simple) : une bonne stratégie + de la réflexion.
 *
 * Équité : l'IA ne connaît pas les pièges cachés. Avant chaque simulation, les pièges pas encore
 * déclenchés sont retirés et replacés au hasard sur des cases libres (« déterminisation »). Les tirages
 * des combats (esquive, critique, fuite) utilisent leur propre aléatoire, pas celui de la vraie partie.
 *
 * Mêmes simulations pour tous les coups (mêmes graines) : la comparaison est plus juste.
 */

/**
 * @param {object} base   stratégie des simulations : chooseMove, chooseFightAction, et rankMoves (cases triées)
 * @param {object} [options]
 * @param {number} [options.rollouts=48]    simulations par coup envisagé
 * @param {number} [options.candidates=5]   nombre de cases envisagées (les meilleures selon la base)
 * @param {number} [options.maxSteps=200]   longueur maximale d'une simulation (actions)
 */
export function createSearchAgent(base, { rollouts = 48, candidates = 5, maxSteps = 200, name = 'godlike' } = {}) {
    // Taux de victoire du joueur `me` après l'action `action`, sur `rollouts` simulations
    const evaluate = (state, action, me, seeds) => {
        let score = 0;
        for (const seed of seeds) {
            const rng = createRng(seed);
            const env = new GameEnv({ rng, maxTurns: maxSteps });
            env.reset(hideTraps(state, rng));
            if (!env.step(action).accepted) return -1;
            while (!env.done) env.step(chooseAction(base, env.state, rng));
            const winner = env.winnerIndex;
            score += winner === null ? 0.5 : winner === me ? 1 : 0;
        }
        return score / seeds.length;
    };

    // Meilleure action parmi `actions` (la première en cas d'égalité : celle que la base préfère)
    const search = (state, actions, me, rng) => {
        const seeds = Array.from({ length: rollouts }, () => Math.floor(rng() * 2 ** 32));
        let best = actions[0], bestScore = -Infinity;
        for (const action of actions) {
            const score = evaluate(state, action, me, seeds);
            if (score > bestScore) { best = action; bestScore = score; }
        }
        return best;
    };

    return {
        name,
        chooseMove(state, rng = Math.random) {
            const ranked = base.rankMoves(state).slice(0, candidates);
            if (ranked.length <= 1) return ranked[0] ?? null;
            const moves = ranked.map(c => ({ type: 'move', row: c.row, col: c.col }));
            const best  = search(state, moves, state.activePlayerIndex, rng);
            return ranked.find(c => c.row === best.row && c.col === best.col);
        },
        chooseFightAction(state, rng = Math.random) {
            const allowed = allowedFightActions(state);
            if (allowed.length <= 1) return allowed[0];
            // La préférence de la base passe en premier (départage des égalités)
            const preferred = base.chooseFightAction(state, rng);
            const ordered = [preferred, ...allowed.filter(a => a !== preferred)].map(type => ({ type }));
            return search(state, ordered, state.fight.attackerIndex, rng).type;
        },
    };
}

/**
 * Copie de l'état où les pièges non déclenchés sont replacés au hasard sur des cases libres
 * (sol, sans joueur, arme, bonus ni piège). Les cases sont copiées : l'état d'origine n'est jamais modifié.
 */
export function hideTraps(state, rng) {
    const cells = state.cells.map(row => row.map(cell => ({ ...cell })));
    const hidden = [];
    for (const cell of cells.flat()) {
        if (cell.trap && !cell.trap.triggered) { hidden.push(cell.trap); cell.trap = null; }
    }
    const free = cells.flat().filter(c => c.decor === DECOR.FLOOR && !c.player && !c.weapon && !c.bonus && !c.trap);
    for (const trap of hidden) {
        if (free.length === 0) break;
        const [cell] = free.splice(Math.floor(rng() * free.length), 1);
        cell.trap = trap;
    }
    return { ...state, cells };
}
