/*
 * Algorithme génétique — générique, indépendant de BoardGame (réutilisable pour d'autres jeux).
 *
 * Un « individu » = un génome = une liste de nombres (ici : les poids d'une fonction de score).
 * À chaque génération :
 *   1. évaluation   : chaque individu reçoit une note (fitness), ex. son taux de victoire ;
 *   2. élitisme     : les meilleurs sont recopiés tels quels (on ne perd jamais le champion) ;
 *   3. sélection    : on choisit des parents, en favorisant les bons (tournoi) ;
 *   4. croisement   : un enfant prend chaque gène à l'un ou l'autre parent ;
 *   5. mutation     : on perturbe un peu certains gènes au hasard (pour explorer).
 * Aucune dérivée, aucun calcul compliqué : juste « garder ce qui marche et essayer des variantes ».
 */
export class GeneticAlgorithm {
    #rng;
    #fitness;

    /**
     * @param {object} options
     * @param {number} options.genomeSize                   nombre de gènes par individu
     * @param {(genome: number[], generation: number) => number} options.fitness  note d'un individu (plus haut = mieux)
     * @param {() => number} options.rng                    aléatoire (graine possible)
     * @param {number} [options.populationSize=30]
     * @param {number} [options.eliteCount=3]               individus recopiés tels quels
     * @param {number} [options.tournamentSize=3]           taille des tournois de sélection
     * @param {number} [options.mutationRate=0.3]           probabilité de muter chaque gène
     * @param {number} [options.mutationStrength=0.3]       amplitude des mutations (écart-type)
     * @param {number[][]} [options.initial]                génomes de départ (sinon aléatoires entre −1 et 1)
     */
    constructor({
        genomeSize, fitness, rng, populationSize = 30, eliteCount = 3, tournamentSize = 3,
        mutationRate = 0.3, mutationStrength = 0.3, initial = null,
    }) {
        this.genomeSize       = genomeSize;
        this.populationSize   = populationSize;
        this.eliteCount       = eliteCount;
        this.tournamentSize   = tournamentSize;
        this.mutationRate     = mutationRate;
        this.mutationStrength = mutationStrength;
        this.#rng     = rng;
        this.#fitness = fitness;

        this.generation = 0;
        this.population = initial
            ? initial.map(g => [...g])
            : Array.from({ length: populationSize }, () => this.#randomGenome());
        this.best = null; // { genome, fitness } du meilleur individu de la dernière génération évaluée
    }

    /**
     * Évalue la génération courante puis fabrique la suivante.
     * @returns {{ generation, best: { genome, fitness }, average, fitnesses: number[] }}
     */
    step() {
        const scored = this.population
            .map(genome => ({ genome, fitness: this.#fitness(genome, this.generation) }))
            .sort((a, b) => b.fitness - a.fitness);

        const fitnesses = scored.map(s => s.fitness);
        const average   = fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length;
        this.best = { genome: [...scored[0].genome], fitness: scored[0].fitness };

        const next = scored.slice(0, this.eliteCount).map(s => [...s.genome]);
        while (next.length < this.populationSize) {
            const child = this.#crossover(this.#tournament(scored), this.#tournament(scored));
            next.push(this.#mutate(child));
        }

        const report = { generation: this.generation, best: this.best, average, fitnesses };
        this.population = next;
        this.generation++;
        return report;
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #randomGenome() {
        return Array.from({ length: this.genomeSize }, () => this.#rng() * 2 - 1);
    }

    // Tournoi : on tire quelques individus au hasard, le meilleur d'entre eux devient parent
    #tournament(scored) {
        let winner = null;
        for (let i = 0; i < this.tournamentSize; i++) {
            const candidate = scored[Math.floor(this.#rng() * scored.length)];
            if (!winner || candidate.fitness > winner.fitness) winner = candidate;
        }
        return winner.genome;
    }

    // Croisement uniforme : chaque gène vient de l'un ou l'autre parent
    #crossover(a, b) {
        return a.map((gene, i) => (this.#rng() < 0.5 ? gene : b[i]));
    }

    // Mutation gaussienne (loi normale, méthode de Box-Muller) sur une partie des gènes
    #mutate(genome) {
        return genome.map(gene => {
            if (this.#rng() >= this.mutationRate) return gene;
            const u = 1 - this.#rng(), v = this.#rng();
            const gaussian = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
            return gene + gaussian * this.mutationStrength;
        });
    }
}
