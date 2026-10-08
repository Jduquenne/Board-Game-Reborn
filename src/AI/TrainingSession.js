import { FightLesson } from './FightLesson.js';
import { MoveLesson } from './MoveLesson.js';

/*
 * Session d'entraînement pilotée par la page « Entraînement de l'IA » (via le Web Worker).
 * Gère la vitesse et les messages ; l'apprentissage lui-même est délégué à une « leçon »
 * (FightLesson : combat par Q-learning, MoveLesson : déplacement par algorithme génétique).
 * Aucun DOM : `post` est la fonction d'envoi (self.postMessage dans le worker, une fonction en test).
 *
 * Messages envoyés :
 *   { type: 'stats', ... }  progression (voir lesson.stats()) + état de la session
 *   { type: 'frame', ... }  état de la partie regardée (vitesses avec plateau)
 *   { type: 'model', lesson, model, gamesPlayed }  modèle exporté (pour l'utiliser dans le jeu)
 */

export const LESSONS = Object.freeze({ fight: FightLesson, move: MoveLesson });

// Vitesses : delay = pause entre deux « tics » (ms) ; frames = plateau affiché ; budget = durée de calcul par tic
export const SPEEDS = Object.freeze({
    watch: { delay: 500, frames: true },              // une action toutes les 0,5 s : on suit la partie
    fast:  { delay: 50,  frames: true },              // une action toutes les 50 ms
    turbo: { delay: 0,   frames: false, budget: 15 }, // ~60 tics/s, plusieurs parties par tic
    max:   { delay: 0,   frames: false, budget: 200 },// calcul en continu, la page est mise à jour 5 fois/s
});

export class TrainingSession {
    #post;
    #lesson;
    #lessonName   = 'fight';
    #opponentName = 'normal';
    #seed         = 1;
    #speed        = 'watch';
    #running      = false;
    #timer        = null;
    #game         = null;

    constructor(post, { lesson = 'fight', opponent = 'normal', seed = 1 } = {}) {
        this.#post = post;
        this.#seed = seed;
        this.reset(opponent, lesson);
    }

    get running() { return this.#running; }
    get speed()   { return this.#speed; }
    get lesson()  { return this.#lesson; }
    get trainer() { return this.#lesson.trainer; }

    // Repart de zéro avec l'adversaire et la leçon choisis
    reset(opponentName = this.#opponentName, lessonName = this.#lessonName) {
        this.pause();
        this.#opponentName = opponentName;
        this.#lessonName   = LESSONS[lessonName] ? lessonName : 'fight';
        this.#lesson = new LESSONS[this.#lessonName]({ opponentName, seed: this.#seed });
        this.#game   = null;
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
        if (this.#lesson) this.#postStats();
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
        this.#post({
            type: 'model',
            lesson: this.#lessonName,
            model: this.#lesson.model(),
            gamesPlayed: this.#lesson.stats().gamesPlayed,
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #schedule() {
        this.#timer = setTimeout(() => this.#tick(), SPEEDS[this.#speed].delay);
    }

    #tick() {
        if (!this.#running) return;
        const speed = SPEEDS[this.#speed];

        if (speed.frames) {
            // Une action de la partie regardée, envoyée à la page pour l'afficher
            this.#game ??= this.#lesson.frames();
            const step = this.#game.next();
            if (step.done) {
                this.#game = null;
                this.#lesson.afterWatchedGame();
                this.#postStats();
            } else {
                this.#post({ type: 'frame', ...step.value, gamesPlayed: this.#lesson.stats().gamesPlayed });
            }
        } else {
            // Termine la partie regardée s'il y en a une, puis apprend sans affichage
            if (this.#game) {
                while (!this.#game.next().done) { /* fin de partie */ }
                this.#game = null;
                this.#lesson.afterWatchedGame();
            }
            this.#lesson.runBatch(performance.now() + speed.budget);
            this.#postStats();
        }

        // La page a pu demander une pause pendant ce tic
        if (this.#running) this.#schedule();
    }

    #postStats() {
        this.#post({
            type: 'stats',
            running: this.#running,
            speed: this.#speed,
            opponent: this.#opponentName,
            lesson: this.#lessonName,
            ...this.#lesson.stats(),
        });
    }
}
