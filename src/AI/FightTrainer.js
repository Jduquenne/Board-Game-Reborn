import { GameEnv, DEFAULT_CONFIG } from './GameEnv.js';
import { runMatch, chooseAction } from './Arena.js';
import { QTable } from './QLearning.js';
import { FIGHT_ACTIONS, fightStateKey, createQFightAgent } from './FightPolicy.js';
import { normalAgent } from './ScriptedAgents.js';
import { createRng } from '../core/Random.js';

/*
 * Entraînement des décisions de combat par Q-learning.
 *
 * L'élève (learner) joue des parties complètes contre un adversaire fixe : il se déplace comme
 * l'IA « normale », mais choisit attaquer / se défendre avec sa table Q (en explorant au début).
 *
 * Récompense : uniquement à la fin de la partie → +1 victoire, −1 défaite, 0 match nul.
 * Chaque décision de combat est corrigée vers la valeur de la décision suivante (Q-learning) :
 * la récompense finale « remonte » ainsi peu à peu vers les premières décisions du combat.
 *
 * Utilisable dans Node (CLI, tests) et dans un Web Worker (page d'entraînement) : aucun DOM.
 */

export const REWARD = Object.freeze({ win: 1, loss: -1, draw: 0 });

// Graine fixe pour l'évaluation : toujours les mêmes parties → courbes comparables
const EVAL_SEED = 777;

export class FightTrainer {
    #rng;
    #config;

    /**
     * @param {object} [options]
     * @param {object} [options.opponent=normalAgent]  adversaire pendant l'entraînement et l'évaluation
     * @param {number} [options.seed=1]                graine des parties d'entraînement
     * @param {object} [options.qOptions]              réglages de la table Q (alpha, gamma, epsilon…)
     */
    constructor({ opponent = normalAgent, seed = 1, config = DEFAULT_CONFIG, qOptions = {}, qtable = null } = {}) {
        this.opponent = opponent;
        this.#rng     = createRng(seed);
        // Table « vierge » : petites valeurs aléatoires → au départ l'IA combat au hasard
        const initRng = createRng(seed + 1);
        this.qtable   = qtable ?? new QTable({
            actions: FIGHT_ACTIONS, alpha: 0.05, initialValue: () => (initRng() - 0.5) * 0.02, ...qOptions,
        });
        this.#config  = config;

        this.gamesPlayed = 0;
        this.results     = { win: 0, loss: 0, draw: 0 };
    }

    /**
     * Partie d'entraînement pas à pas (générateur) : rend l'état après chaque action.
     * Permet de regarder la partie à vitesse réduite ; playGame() la joue d'un coup.
     * La valeur de retour finale est le résultat de l'élève : 'win' | 'loss' | 'draw'.
     */
    *trainingGame() {
        const env = new GameEnv({ config: this.#config, rng: this.#rng });
        env.reset();

        // L'élève commence une partie sur deux (le joueur 0 joue en premier)
        const learnerIndex = this.gamesPlayed % 2;
        const learner = createQFightAgent(this.qtable, { explore: true, name: 'learner' });
        const agents  = learnerIndex === 0 ? [learner, this.opponent] : [this.opponent, learner];

        let pending = null; // dernière décision de combat de l'élève, pas encore corrigée
        yield { state: env.state, learnerIndex };

        while (!env.done) {
            const actor  = env.currentPlayerIndex;
            const action = chooseAction(agents[actor], env.state, this.#rng);

            // Décision de combat de l'élève : on corrige la précédente vers celle-ci
            if (actor === learnerIndex && env.state.phase === 'fighting') {
                const key = fightStateKey(env.state);
                if (pending) this.qtable.update(pending.key, pending.action, 0, key);
                pending = { key, action: action.type };
            }

            env.step(action);
            yield { state: env.state, learnerIndex, action, actor };
        }

        const outcome = env.winnerIndex === null ? 'draw' : env.winnerIndex === learnerIndex ? 'win' : 'loss';
        if (pending) this.qtable.update(pending.key, pending.action, REWARD[outcome], null);

        this.qtable.decayEpsilon();
        this.gamesPlayed++;
        this.results[outcome]++;
        return outcome;
    }

    // Joue une partie d'entraînement complète d'un coup
    playGame() {
        const game = this.trainingGame();
        let step = game.next();
        while (!step.done) step = game.next();
        return step.value;
    }

    // Joue n parties d'entraînement ; retourne les résultats de ce lot
    train(games) {
        const batch = { win: 0, loss: 0, draw: 0 };
        for (let i = 0; i < games; i++) batch[this.playGame()]++;
        return batch;
    }

    /**
     * Mesure le niveau actuel, sans exploration ni apprentissage, toujours sur les mêmes parties.
     * @returns {{ winRate, drawRate, lossRate, games }}
     */
    evaluate(games = 400) {
        const agent = createQFightAgent(this.qtable, { explore: false });
        const r = runMatch(agent, this.opponent, { games, seed: EVAL_SEED, config: this.#config });
        return { games, winRate: r.winsA / games, drawRate: r.draws / games, lossRate: r.winsB / games };
    }
}
