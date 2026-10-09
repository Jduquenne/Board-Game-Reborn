import { GeneticAlgorithm } from './Genetic.js';
import { MOVE_FEATURES, createWeightedMoveAgent } from './MoveFeatures.js';
import { normalAgent } from './ScriptedAgents.js';
import { runMatch } from './Arena.js';
import { DEFAULT_CONFIG } from './GameEnv.js';
import { createRng } from '../core/Random.js';

/*
 * Entraînement du déplacement par algorithme génétique.
 *
 * Chaque individu = les poids d'une fonction de score (voir MoveFeatures.js) ; il combat avec la
 * règle de l'IA Normal (on n'apprend que le déplacement). Sa note (fitness) = son taux de victoire
 * contre l'adversaire sur un lot de parties ; tous les individus d'une génération jouent les MÊMES
 * parties (même graine) pour que la comparaison soit équitable.
 *
 * Le meilleur de chaque génération est ensuite mesuré sur 400 parties fixes (graine 777), les
 * mêmes que pour les combats : c'est la courbe affichée.
 */

const EVAL_SEED = 777;

export class MoveTrainer {
    #ga;
    #config;
    #seed;
    #makeAgent;
    #sparring;

    /**
     * @param {object} [options]
     * @param {number} [options.genomeSize]   nombre de poids (par défaut : MOVE_FEATURES)
     * @param {(genome: number[]) => object} [options.makeAgent]  agent jouable à partir d'un génome
     *                                        (par défaut : fonction de score du champion, MoveFeatures.js)
     * @param {object[]} [options.sparring]   autres adversaires de la note (fitness), en plus de `opponent`
     */
    constructor({
        opponent = normalAgent, seed = 1, config = DEFAULT_CONFIG, gamesPerIndividual = 60, gaOptions = {},
        genomeSize = MOVE_FEATURES.length, makeAgent = genome => createWeightedMoveAgent(genome, { name: 'evolved' }),
        sparring = [],
    } = {}) {
        this.#sparring = sparring;
        this.opponent = opponent;
        this.gamesPerIndividual = gamesPerIndividual;
        this.#config = config;
        this.#seed   = seed;
        this.#makeAgent = makeAgent;

        this.#ga = new GeneticAlgorithm({
            genomeSize,
            rng: createRng(seed),
            fitness: (genome, generation) => this.#fitness(genome, generation),
            ...gaOptions,
        });

        this.gamesPlayed = 0;
        this.lastReport  = null;
    }

    get generation() { return this.#ga.generation; }
    get populationSize() { return this.#ga.populationSize; }
    get bestGenome() { return this.#ga.best?.genome ?? null; }
    get population() { return this.#ga.population; }

    // Une génération : évalue toute la population puis fabrique la suivante
    nextGeneration() {
        this.lastReport = this.#ga.step();
        return this.lastReport;
    }

    // Agent jouable à partir d'un génome (par défaut : le meilleur connu)
    agent(genome = this.bestGenome) {
        return this.#makeAgent(genome);
    }

    /** Mesure le meilleur individu sur les parties d'évaluation fixes. */
    evaluate(games = 400, genome = this.bestGenome) {
        const r = runMatch(this.agent(genome), this.opponent, { games, seed: EVAL_SEED, config: this.#config });
        return { games, winRate: r.winsA / games, drawRate: r.draws / games, lossRate: r.winsB / games };
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    // Taux de victoire (un nul compte pour moitié) sur les parties de la génération
    // Avec des partenaires d'entraînement (sparring), moyenne sur l'adversaire principal et chacun d'eux
    #fitness(genome, generation) {
        const games = this.gamesPerIndividual;
        const opponents = [this.opponent, ...this.#sparring];
        let total = 0;
        for (const opponent of opponents) {
            const r = runMatch(this.agent(genome), opponent, {
                games, seed: this.#seed * 100003 + generation, config: this.#config,
            });
            this.gamesPlayed += games;
            total += (r.winsA + r.draws / 2) / games;
        }
        return total / opponents.length;
    }
}
