import { NeuralNetwork } from './NeuralNetwork.js';
import { MOVE_INPUT_SIZE, moveInputs, candidateCells, createNeuralMoveAgent } from './NeuralMovePolicy.js';
import { createWeightedMoveAgent, moveContext, moveFeatures, scoreCell } from './MoveFeatures.js';
import { CHAMPION_MOVE_WEIGHTS } from './DefaultModels.js';
import { normalAgent } from './ScriptedAgents.js';
import { GameEnv, DEFAULT_CONFIG } from './GameEnv.js';
import { runMatch, chooseAction } from './Arena.js';
import { createRng } from '../core/Random.js';

/*
 * Apprentissage supervisé par imitation (behavioral cloning) :
 *   1. on fait jouer un « maître » (le champion génétique) et on enregistre chacune de ses décisions
 *      de déplacement : les cases possibles (en données brutes) + celle qu'il a choisie ;
 *   2. le réseau apprend à donner la meilleure note à la case que le maître a choisie.
 *
 * Erreur utilisée : l'« entropie croisée » sur un softmax. Les notes des cases sont transformées en
 * probabilités (softmax) ; l'erreur compare ces probabilités à une cible :
 *   - « étiquette dure » : 100 % sur la case jouée par le maître. Problème : quand plusieurs cases
 *     ont la même note pour le maître, il prend la première du plateau — un choix arbitraire que le
 *     réseau essaie d'apprendre par cœur (étiquettes bruitées) ;
 *   - « distillation » (par défaut) : la cible est le softmax des NOTES du maître pour toutes les cases
 *     (divisées par une température). Le réseau apprend aussi « presque aussi bonne » et « très mauvaise ».
 * Pente de l'erreur pour la note d'une case : probabilité du réseau − probabilité cible.
 *
 * Les parties sont séparées en deux : 80 % pour apprendre (train), 20 % pour vérifier (test) sur des
 * situations jamais vues. Si l'erreur baisse sur « train » mais remonte sur « test », le réseau
 * apprend par cœur au lieu de comprendre (sur-apprentissage).
 */

const EVAL_SEED = 777;

export class ImitationTrainer {
    #rng;
    #config;
    #epoch = null; // époque en cours : { order, cursor, loss, correct }

    constructor({
        teacherWeights = CHAMPION_MOVE_WEIGHTS,
        opponent = normalAgent, seed = 1, hidden = [32, 16], learningRate = 0.003, batchSize = 32,
        distillation = true, temperature = 0.25, config = DEFAULT_CONFIG,
    } = {}) {
        this.teacherWeights = teacherWeights;
        this.teacher      = createWeightedMoveAgent(teacherWeights, { name: 'champion' });
        this.distillation = distillation;
        this.temperature  = temperature;
        this.opponent     = opponent;
        this.learningRate = learningRate;
        this.batchSize    = batchSize;
        this.#rng    = createRng(seed);
        this.#config = config;

        this.network = new NeuralNetwork({ sizes: [MOVE_INPUT_SIZE, ...hidden, 1], activation: 'relu', optimizer: 'adam', rng: createRng(seed + 11) });
        this.train = [];
        this.test  = [];
        this.epochs = 0;
        this.gamesRecorded = 0;
    }

    /** Fait jouer le maître et enregistre ses décisions (1 partie sur 5 va dans le jeu de test). */
    collect(games) {
        for (let g = 0; g < games; g++) {
            const env = new GameEnv({ config: this.#config, rng: this.#rng });
            env.reset();
            const teacherIndex = this.gamesRecorded % 2;
            const agents  = teacherIndex === 0 ? [this.teacher, this.opponent] : [this.opponent, this.teacher];
            const dataset = this.gamesRecorded % 5 === 4 ? this.test : this.train;

            while (!env.done) {
                const actor  = env.currentPlayerIndex;
                const action = chooseAction(agents[actor], env.state, this.#rng);

                if (actor === teacherIndex && action.type === 'move') {
                    const cells = candidateCells(env.state);
                    if (cells.length > 1) {
                        const context = moveContext(env.state);
                        const teacherScores = cells.map(c => scoreCell(this.teacherWeights, moveFeatures(env.state, c, context)));
                        dataset.push({
                            inputs: cells.map(c => moveInputs(env.state, c)),
                            target: cells.findIndex(c => c.row === action.row && c.col === action.col),
                            soft: softmax(teacherScores.map(t => t / this.temperature)),
                        });
                    }
                }
                env.step(action);
            }
            this.gamesRecorded++;
        }
        return { train: this.train.length, test: this.test.length };
    }

    /** Une époque : un passage complet sur les exemples d'apprentissage, par lots. */
    trainEpoch() {
        let report = null;
        while (!report) report = this.trainBatch();
        return report;
    }

    /**
     * Un seul lot (pour avancer par petits morceaux, ex. depuis la page d'entraînement).
     * @returns {object|null} le bilan de l'époque si ce lot la termine, sinon null
     */
    trainBatch() {
        this.#epoch ??= { order: shuffle(this.train.map((_, i) => i), this.#rng), cursor: 0, loss: 0, correct: 0 };
        const e = this.#epoch;

        for (const index of e.order.slice(e.cursor, e.cursor + this.batchSize)) {
            const r = this.#learnFrom(this.train[index]);
            e.loss += r.loss;
            if (r.correct) e.correct++;
        }
        this.network.step(this.learningRate);
        e.cursor += this.batchSize;
        if (e.cursor < e.order.length) return null;

        this.#epoch = null;
        this.epochs++;
        const n = e.order.length;
        return { epoch: this.epochs, trainLoss: e.loss / n, trainAccuracy: e.correct / n, ...this.measure(this.test) };
    }

    // Avancement de l'époque en cours, entre 0 et 1
    get epochProgress() {
        return this.#epoch ? Math.min(1, this.#epoch.cursor / this.#epoch.order.length) : 0;
    }

    /** Erreur et précision (le réseau choisit-il la même case que le maître ?) sans apprendre. */
    measure(samples) {
        let loss = 0, correct = 0;
        for (const sample of samples) {
            const scores = sample.inputs.map(x => this.network.forward(x).output[0]);
            loss += crossEntropy(softmax(scores), this.#goal(sample));
            if (argmax(scores) === sample.target) correct++;
        }
        const n = Math.max(1, samples.length);
        return { testLoss: loss / n, testAccuracy: correct / n };
    }

    agent() {
        return createNeuralMoveAgent(this.network);
    }

    /** Taux de victoire du réseau contre l'adversaire, sur les parties d'évaluation fixes. */
    evaluate(games = 400) {
        const r = runMatch(this.agent(), this.opponent, { games, seed: EVAL_SEED, config: this.#config });
        return { games, winRate: r.winsA / games, drawRate: r.draws / games };
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    // Un exemple : notes de toutes les cases → softmax → pente (p − cible) renvoyée dans le réseau
    #learnFrom({ inputs, target, soft }) {
        const traces = inputs.map(x => this.network.forward(x));
        const scores = traces.map(t => t.output[0]);
        const probs  = softmax(scores);
        const goal   = this.#goal({ inputs, target, soft });

        traces.forEach((trace, i) => this.network.backward(trace, [probs[i] - goal[i]]));
        // Le réseau a vu une seule décision, même si elle comporte plusieurs cases
        this.network.gradCount -= traces.length - 1;

        return { loss: crossEntropy(probs, goal), correct: argmax(scores) === target };
    }

    // Probabilités cibles d'un exemple : notes du maître (distillation) ou 100 % sur son coup
    #goal({ inputs, target, soft }) {
        return this.distillation ? soft : inputs.map((_, i) => (i === target ? 1 : 0));
    }
}

// Entropie croisée : −Σ cible × log(probabilité du réseau)
function crossEntropy(probs, goal) {
    let sum = 0;
    for (let i = 0; i < probs.length; i++) if (goal[i] > 0) sum -= goal[i] * Math.log(Math.max(probs[i], 1e-12));
    return sum;
}

function softmax(scores) {
    const max  = Math.max(...scores);
    const exps = scores.map(s => Math.exp(s - max));
    const sum  = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
}

function argmax(values) {
    let best = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
    return best;
}

function shuffle(array, rng) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
