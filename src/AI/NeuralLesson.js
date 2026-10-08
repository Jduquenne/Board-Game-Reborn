import { ImitationTrainer } from './ImitationTrainer.js';
import { SCRIPTED_AGENTS } from './ScriptedAgents.js';
import { runMatch, gameSteps } from './Arena.js';
import { createRng } from '../core/Random.js';

const REFERENCE_GAMES = 400;
const EVAL_GAMES      = 200;  // l'évaluation d'un réseau est plus lente : 200 parties suffisent pour la courbe
const EVAL_SEED       = 777;
const RECORDED_GAMES  = 800;  // parties du maître enregistrées au départ (≈ 8 000 décisions)

/*
 * Leçon « Réseau de neurones » : un réseau apprend à imiter le champion génétique (voir ImitationTrainer).
 * Même interface que FightLesson / MoveLesson. L'apprentissage se fait par époques (passages complets
 * sur les décisions enregistrées) ; après chaque époque : erreur d'apprentissage / de test et taux de
 * victoire. Les parties à regarder sont des démonstrations du réseau contre l'adversaire.
 */
export class NeuralLesson {
    name = 'neural';
    #trainer;
    #opponent;
    #history = [];
    #losses  = [];
    #reference;
    #demoRng;

    constructor({ opponentName = 'normal', seed = 1 } = {}) {
        this.#opponent = SCRIPTED_AGENTS[opponentName];
        this.#trainer  = new ImitationTrainer({ opponent: this.#opponent, seed });
        this.#trainer.collect(RECORDED_GAMES);
        this.#demoRng  = createRng(seed + 7);

        const ref = runMatch(SCRIPTED_AGENTS.normal, this.#opponent, { games: REFERENCE_GAMES, seed: EVAL_SEED });
        this.#reference = ref.winsA / REFERENCE_GAMES;

        // Point de départ : le réseau aux poids aléatoires
        const start = this.#trainer.evaluate(EVAL_GAMES);
        const test  = this.#trainer.measure(this.#trainer.test);
        this.#history.push({ games: 0, winRate: start.winRate, drawRate: start.drawRate });
        this.#losses.push({ epoch: 0, train: test.testLoss, test: test.testLoss });
    }

    get trainer() { return this.#trainer; }

    *frames() {
        const steps = gameSteps([this.#trainer.agent(), this.#opponent], { rng: this.#demoRng });
        for (const step of steps) yield { ...step, learnerIndex: 0, demo: true };
    }

    afterWatchedGame() {}

    runBatch(deadline) {
        do {
            const report = this.#trainer.trainBatch();
            if (report) {
                const e = this.#trainer.evaluate(EVAL_GAMES);
                this.#history.push({ games: report.epoch, winRate: e.winRate, drawRate: e.drawRate });
                this.#losses.push({ epoch: report.epoch, train: report.trainLoss, test: report.testLoss });
            }
        } while (performance.now() < deadline);
    }

    stats() {
        const t = this.#trainer;
        return {
            gamesPlayed: t.gamesRecorded,
            progress: { label: 'époques', value: `${t.epochs} (+${Math.round(t.epochProgress * 100)} %)` },
            xLabel: 'époques',
            reference: this.#reference,
            history: this.#history,
            losses: this.#losses,
            network: { sizes: t.network.sizes, parameters: t.network.parameterCount, train: t.train.length, test: t.test.length },
        };
    }

    model() {
        return { kind: 'network', network: this.#trainer.network.toJSON() };
    }
}
