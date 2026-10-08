import { createGame, applyMove, applyPass, applyAttack, applyDefend, resolveRound } from '../Engine/Rules.js';

// Configuration par défaut d'une partie simulée (mêmes valeurs que les options par défaut du jeu)
export const DEFAULT_CONFIG = Object.freeze({
    rows: 10, cols: 10, nbObstacles: 10, nbWeapons: 3, nbBonus: 3, nbTraps: 3, aiMode: 'none',
});

/**
 * Environnement de simulation : une partie complète, sans Store, EventBus, délais ni DOM.
 * C'est le « monde » dans lequel une IA joue et apprend, des milliers de fois par seconde.
 *
 *   const env = new GameEnv({ rng: createRng(42) });
 *   env.reset();
 *   while (!env.done) env.step(choisirAction(env.state));
 *
 * Actions possibles (step) :
 *   { type: 'move', row, col }  — en phase 'playing', vers une case isMovable
 *   { type: 'pass' }            — en phase 'playing', si aucune case n'est accessible
 *   { type: 'attack' } / { type: 'defend' } — en phase 'fighting' ; le round est résolu immédiatement
 */
export class GameEnv {
    #config;
    #rng;
    #maxTurns;

    state = null;
    turns = 0;

    constructor({ config = DEFAULT_CONFIG, rng = Math.random, maxTurns = 300 } = {}) {
        this.#config   = config;
        this.#rng      = rng;
        this.#maxTurns = maxTurns;
    }

    // Nouvelle partie
    reset() {
        this.state = createGame(this.#config, this.#rng);
        this.turns = 0;
        return this.state;
    }

    // Partie terminée : victoire, ou limite de tours atteinte (match nul)
    get done() {
        return this.state.phase === 'gameover' || this.turns >= this.#maxTurns;
    }

    // Index du joueur qui doit agir maintenant
    get currentPlayerIndex() {
        return this.state.phase === 'fighting' ? this.state.fight.attackerIndex : this.state.activePlayerIndex;
    }

    // Index du gagnant, ou null (partie en cours ou match nul)
    get winnerIndex() {
        if (this.state.phase !== 'gameover') return null;
        return this.state.players.findIndex(p => p.player.health > 0);
    }

    /**
     * Joue une action. Une action illégale ne change rien (accepted: false).
     * @returns {{ state, events, accepted: boolean, done: boolean }}
     */
    step(action) {
        const before = this.state;
        let result;

        switch (action.type) {
            case 'move':   result = applyMove(before, action.row, action.col); break;
            case 'pass':   result = applyPass(before); break;
            case 'attack':
            case 'defend': result = this.#fightStep(before, action.type); break;
            default:       throw new Error(`Unknown action type: ${action.type}`);
        }

        const accepted = result.state !== before;
        if (accepted) {
            this.state = result.state;
            this.turns++;
        }
        return { state: this.state, events: result.events, accepted, done: this.done };
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    // Action de combat + résolution immédiate du round (pas de délai d'affichage en simulation)
    #fightStep(state, type) {
        const acted = (type === 'attack' ? applyAttack : applyDefend)(state);
        if (acted.state === state) return acted;

        const { attackerIndex, targetIndex } = state.fight;
        const resolved = resolveRound(acted.state, attackerIndex, targetIndex);
        return { state: resolved.state, events: [...acted.events, ...resolved.events] };
    }
}
