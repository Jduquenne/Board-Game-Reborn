import { FightTrainer } from './FightTrainer.js';
import { describeFightKey } from './FightPolicy.js';
import { SCRIPTED_AGENTS } from './ScriptedAgents.js';
import { runMatch } from './Arena.js';

const EVAL_GAMES = 400;
const EVAL_SEED  = 777; // mêmes parties que FightTrainer.evaluate()

/*
 * Leçon « Combat » : Q-learning de la décision attaquer / se défendre (voir FightTrainer).
 * Interface commune des leçons, utilisée par TrainingSession :
 *   frames()          générateur d'une partie à regarder (rend { state, learnerIndex, actor, action })
 *   afterWatchedGame() appelé quand la partie regardée est finie
 *   runBatch(deadline) entraîne jusqu'à l'heure limite (performance.now())
 *   stats()           données affichées par la page
 *   model()           modèle à enregistrer pour le jeu
 */
export class FightLesson {
    name = 'fight';
    #trainer;
    #history  = [];
    #nextEval = 0;
    #reference;

    constructor({ opponentName = 'normal', seed = 1 } = {}) {
        const opponent  = SCRIPTED_AGENTS[opponentName];
        this.#trainer   = new FightTrainer({ opponent, seed });
        const ref       = runMatch(SCRIPTED_AGENTS.normal, opponent, { games: EVAL_GAMES, seed: EVAL_SEED });
        this.#reference = ref.winsA / EVAL_GAMES;
        this.#evaluateIfDue();
    }

    get trainer() { return this.#trainer; }

    // On regarde une vraie partie d'entraînement : l'IA apprend pendant qu'on regarde
    frames() {
        return this.#trainer.trainingGame();
    }

    afterWatchedGame() {
        this.#evaluateIfDue();
    }

    runBatch(deadline) {
        do {
            this.#trainer.playGame();
            this.#evaluateIfDue();
        } while (performance.now() < deadline);
    }

    stats() {
        const { gamesPlayed, qtable } = this.#trainer;
        return {
            gamesPlayed,
            progress: { label: 'exploration', value: `${Math.round(qtable.epsilon * 100)} %` },
            reference: this.#reference,
            history: this.#history,
            policy: qtable.entries().map(({ key, values }) => ({
                key, values, best: qtable.best(key), ...describeFightKey(key),
            })),
        };
    }

    model() {
        return this.#trainer.qtable.toJSON();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    // Évaluation régulière : très souvent au début (c'est là que la courbe bouge), plus espacée ensuite
    #evaluateIfDue() {
        const games = this.#trainer.gamesPlayed;
        if (games < this.#nextEval) return;

        const e = this.#trainer.evaluate(EVAL_GAMES);
        this.#history.push({ games, winRate: e.winRate, drawRate: e.drawRate });
        this.#nextEval = games + (games < 1000 ? 100 : games < 5000 ? 500 : 2500);
    }
}
