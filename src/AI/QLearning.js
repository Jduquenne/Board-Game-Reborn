/*
 * Q-learning tabulaire — générique, indépendant de BoardGame (réutilisable pour d'autres jeux).
 *
 * Idée : une table qui donne, pour chaque situation (clé d'état) et chaque action possible,
 * une estimation de « ce que cette action rapporte à long terme » : la valeur Q.
 * L'agent choisit l'action de plus grande valeur, et corrige la table après chaque coup :
 *
 *   Q(s, a) ← Q(s, a) + α · ( r + γ · max Q(s', ·) − Q(s, a) )
 *
 *   s, a  : situation et action jouée      r  : récompense reçue
 *   s'    : situation suivante             α  : vitesse d'apprentissage (alpha)
 *   γ     : importance du futur (gamma)    max Q(s', ·) = 0 si la partie est finie
 *
 * Exploration (epsilon-greedy) : avec la probabilité ε, l'agent joue au hasard pour découvrir
 * de nouvelles choses ; sinon il joue la meilleure action connue. ε diminue au fil des parties.
 */
export class QTable {
    #table = new Map();

    /**
     * @param {object} options
     * @param {string[]} options.actions        actions possibles, ex. ['attack', 'defend']
     * @param {number} [options.alpha=0.1]      vitesse d'apprentissage (0 → n'apprend rien, 1 → oublie tout le passé)
     * @param {number} [options.gamma=0.95]     importance des récompenses futures (0 → seulement l'immédiat)
     * @param {number} [options.epsilon=1]     probabilité d'explorer (1 → toujours au hasard)
     * @param {number} [options.epsilonMin=0.05]
     * @param {number} [options.epsilonDecay=0.9995]  ε est multiplié par ce facteur après chaque partie
     * @param {() => number} [options.initialValue]  valeur de départ d'une case de la table (0 par défaut ;
     *                                               petites valeurs aléatoires = IA « vierge » qui joue au hasard)
     */
    constructor({ actions, alpha = 0.1, gamma = 0.95, epsilon = 1, epsilonMin = 0.05, epsilonDecay = 0.9995, initialValue = () => 0 }) {
        this.actions      = actions;
        this.alpha        = alpha;
        this.gamma        = gamma;
        this.epsilon      = epsilon;
        this.epsilonMin   = epsilonMin;
        this.epsilonDecay = epsilonDecay;
        this.initialValue = initialValue;
    }

    // Nombre de situations déjà rencontrées
    get size() {
        return this.#table.size;
    }

    // Valeurs Q d'une situation (une par action), créées à 0 la première fois
    values(key) {
        if (!this.#table.has(key)) this.#table.set(key, this.actions.map(() => this.initialValue()));
        return this.#table.get(key);
    }

    // Meilleure action connue (en cas d'égalité, la première de la liste)
    // allowed : actions possibles dans cette situation (par défaut toutes), ex. pas de fuite sans case de repli
    best(key, allowed = this.actions) {
        const values = this.values(key);
        let bestIndex = -1;
        for (let i = 0; i < values.length; i++) {
            if (!allowed.includes(this.actions[i])) continue;
            if (bestIndex < 0 || values[i] > values[bestIndex]) bestIndex = i;
        }
        return this.actions[bestIndex];
    }

    // Choix epsilon-greedy : explore au hasard avec la probabilité epsilon, sinon exploite
    choose(key, rng = Math.random, allowed = this.actions) {
        if (rng() < this.epsilon) return allowed[Math.floor(rng() * allowed.length)];
        return this.best(key, allowed);
    }

    /**
     * Corrige la valeur de (key, action) avec la récompense reçue.
     * @param {string|null} nextKey  situation suivante, ou null si la partie est terminée
     */
    update(key, action, reward, nextKey) {
        const values   = this.values(key);
        const index    = this.actions.indexOf(action);
        const future   = nextKey === null ? 0 : Math.max(...this.values(nextKey));
        const target   = reward + this.gamma * future;
        values[index] += this.alpha * (target - values[index]);
    }

    // Réduit l'exploration (à appeler après chaque partie)
    decayEpsilon() {
        this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
    }

    // Toutes les situations connues : [{ key, values }]
    entries() {
        return [...this.#table].map(([key, values]) => ({ key, values: [...values] }));
    }

    // Sauvegarde / chargement (JSON) — seule la table et les actions comptent pour jouer
    toJSON() {
        return { actions: this.actions, table: Object.fromEntries(this.#table) };
    }

    static fromJSON({ actions, table }, options = {}) {
        const q = new QTable({ actions, epsilon: 0, ...options });
        for (const [key, values] of Object.entries(table)) q.#table.set(key, [...values]);
        return q;
    }
}
