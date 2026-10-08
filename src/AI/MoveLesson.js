import { MoveTrainer } from './MoveTrainer.js';
import { MOVE_FEATURES } from './MoveFeatures.js';
import { SCRIPTED_AGENTS } from './ScriptedAgents.js';
import { runMatch, gameSteps } from './Arena.js';
import { createRng } from '../core/Random.js';

const EVAL_GAMES = 400;
const EVAL_SEED  = 777;

/*
 * Leçon « Déplacement » : algorithme génétique sur les poids de la fonction de score (voir MoveTrainer).
 * Même interface que FightLesson. Différence : l'algorithme génétique n'apprend pas pendant une
 * partie mais entre les générations ; les parties à regarder sont donc des démonstrations du
 * champion actuel contre l'adversaire (l'entraînement est en pause pendant ce temps).
 */
export class MoveLesson {
    name = 'move';
    #trainer;
    #opponent;
    #history = [];
    #reference;
    #demoRng;

    constructor({ opponentName = 'normal', seed = 1 } = {}) {
        this.#opponent  = SCRIPTED_AGENTS[opponentName];
        this.#trainer   = new MoveTrainer({ opponent: this.#opponent, seed });
        this.#demoRng   = createRng(seed + 7);
        const ref       = runMatch(SCRIPTED_AGENTS.normal, this.#opponent, { games: EVAL_GAMES, seed: EVAL_SEED });
        this.#reference = ref.winsA / EVAL_GAMES;

        // Point de départ de la courbe : un individu de la première génération, aux poids aléatoires
        const start = this.#trainer.evaluate(EVAL_GAMES, this.#trainer.population[0]);
        this.#history.push({ games: 0, winRate: start.winRate, drawRate: start.drawRate });
    }

    get trainer() { return this.#trainer; }

    // Démonstration : le champion (ou un individu de départ) contre l'adversaire ; l'élève est le joueur 0
    *frames() {
        const genome = this.#trainer.bestGenome ?? this.#trainer.population[0];
        const steps  = gameSteps([this.#trainer.agent(genome), this.#opponent], { rng: this.#demoRng });
        for (const step of steps) yield { ...step, learnerIndex: 0, demo: true };
    }

    afterWatchedGame() {}

    // Une génération au moins par appel (une génération dure plus longtemps qu'un tic)
    runBatch(deadline) {
        do {
            this.#trainer.nextGeneration();
            const e = this.#trainer.evaluate(EVAL_GAMES);
            this.#history.push({ games: this.#trainer.gamesPlayed, winRate: e.winRate, drawRate: e.drawRate });
        } while (performance.now() < deadline);
    }

    stats() {
        const { gamesPlayed, generation, lastReport, bestGenome } = this.#trainer;
        return {
            gamesPlayed,
            progress: { label: 'générations', value: String(generation) },
            reference: this.#reference,
            history: this.#history,
            weights: bestGenome
                ? MOVE_FEATURES.map((f, i) => ({ key: f.key, label: f.label, value: bestGenome[i] }))
                : [],
            population: lastReport
                ? { best: lastReport.best.fitness, average: lastReport.average }
                : null,
        };
    }

    model() {
        return { features: MOVE_FEATURES.map(f => f.key), weights: this.#trainer.bestGenome };
    }
}
