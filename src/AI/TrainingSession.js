import { FightTrainer } from './FightTrainer.js';
import { describeFightKey } from './FightPolicy.js';
import { SCRIPTED_AGENTS } from './ScriptedAgents.js';
import { runMatch } from './Arena.js';

/*
 * Session d'entraînement pilotée par la page « Entraînement de l'IA » (via le Web Worker).
 * Gère la vitesse, les évaluations régulières et les messages envoyés à la page.
 * Aucun DOM : `post` est la fonction d'envoi (self.postMessage dans le worker, une fonction en test).
 *
 * Messages envoyés :
 *   { type: 'stats', ... }  progression (parties, exploration, courbe, stratégie apprise)
 *   { type: 'frame', ... }  état de la partie en cours, pour la regarder (vitesses avec plateau)
 *   { type: 'model', model } table Q exportée (pour l'utiliser dans le jeu)
 */

// Vitesses : delay = pause entre deux « tics » (ms) ; frames = plateau affiché ; budget = durée de calcul par tic
export const SPEEDS = Object.freeze({
    watch: { delay: 500, frames: true },              // une action toutes les 0,5 s : on suit la partie
    fast:  { delay: 50,  frames: true },              // une action toutes les 50 ms
    turbo: { delay: 0,   frames: false, budget: 15 }, // ~60 tics/s, plusieurs parties par tic
    max:   { delay: 0,   frames: false, budget: 200 },// calcul en continu, la page est mise à jour 5 fois/s
});

const EVAL_GAMES = 400;
const EVAL_SEED  = 777; // mêmes parties que FightTrainer.evaluate()

export class TrainingSession {
    #post;
    #trainer;
    #opponentName = 'normal';
    #speed        = 'watch';
    #running      = false;
    #timer        = null;
    #game         = null;
    #nextEval     = 0;
    #history      = [];
    #reference    = null;

    constructor(post, { opponent = 'normal', seed = 1 } = {}) {
        this.#post = post;
        this.reset(opponent, seed);
    }

    get running() { return this.#running; }
    get speed()   { return this.#speed; }
    get trainer() { return this.#trainer; }

    // Repart de zéro (table Q vierge) contre l'adversaire choisi
    reset(opponentName = this.#opponentName, seed = 1) {
        this.pause();
        this.#opponentName = opponentName;
        this.#trainer  = new FightTrainer({ opponent: SCRIPTED_AGENTS[opponentName], seed });
        this.#game     = null;
        this.#history  = [];
        this.#nextEval = 0;

        // Référence : l'IA « normale » (combat écrit à la main) sur les mêmes parties d'évaluation
        const ref = runMatch(SCRIPTED_AGENTS.normal, SCRIPTED_AGENTS[opponentName], { games: EVAL_GAMES, seed: EVAL_SEED });
        this.#reference = ref.winsA / EVAL_GAMES;

        this.#evaluateIfDue();
        this.#postStats();
    }

    start() {
        if (this.#running) return;
        this.#running = true;
        this.#postStats();
        this.#schedule();
    }

    pause() {
        this.#running = false;
        clearTimeout(this.#timer);
        this.#timer = null;
        if (this.#trainer) this.#postStats();
    }

    setSpeed(speed) {
        if (!SPEEDS[speed]) return;
        this.#speed = speed;
        if (this.#running) {
            clearTimeout(this.#timer);
            this.#schedule();
        }
        this.#postStats();
    }

    exportModel() {
        this.#post({ type: 'model', model: this.#trainer.qtable.toJSON(), gamesPlayed: this.#trainer.gamesPlayed });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #schedule() {
        this.#timer = setTimeout(() => this.#tick(), SPEEDS[this.#speed].delay);
    }

    #tick() {
        if (!this.#running) return;
        const speed = SPEEDS[this.#speed];

        if (speed.frames) {
            // Une action de la partie en cours, envoyée à la page pour l'afficher
            this.#game ??= this.#trainer.trainingGame();
            const step = this.#game.next();
            if (step.done) {
                this.#game = null;
                this.#evaluateIfDue();
                this.#postStats();
            } else {
                this.#post({ type: 'frame', ...step.value, gamesPlayed: this.#trainer.gamesPlayed });
            }
        } else {
            // Termine la partie regardée s'il y en a une, puis enchaîne les parties sans affichage
            if (this.#game) {
                while (!this.#game.next().done) { /* fin de partie */ }
                this.#game = null;
                this.#evaluateIfDue();
            }
            const end = performance.now() + speed.budget;
            do {
                this.#trainer.playGame();
                this.#evaluateIfDue();
            } while (performance.now() < end);
            this.#postStats();
        }

        // La page a pu demander une pause pendant ce tic
        if (this.#running) this.#schedule();
    }

    // Évaluation régulière : très souvent au début (c'est là que la courbe bouge), plus espacée ensuite
    #evaluateIfDue() {
        const games = this.#trainer.gamesPlayed;
        if (games < this.#nextEval) return;

        const e = this.#trainer.evaluate(EVAL_GAMES);
        this.#history.push({ games, winRate: e.winRate, drawRate: e.drawRate });
        this.#nextEval = games + (games < 1000 ? 100 : games < 5000 ? 500 : 2500);
    }

    #postStats() {
        const { gamesPlayed, results, qtable } = this.#trainer;
        this.#post({
            type: 'stats',
            running: this.#running,
            speed: this.#speed,
            opponent: this.#opponentName,
            gamesPlayed,
            results: { ...results },
            epsilon: qtable.epsilon,
            states: qtable.size,
            reference: this.#reference,
            history: this.#history,
            policy: qtable.entries().map(({ key, values }) => ({
                key, values, best: qtable.best(key), ...describeFightKey(key),
            })),
        });
    }
}
