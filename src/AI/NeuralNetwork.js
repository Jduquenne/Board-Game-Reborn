/*
 * Réseau de neurones « perceptron multicouche » — écrit à la main, générique (réutilisable pour d'autres jeux).
 *
 * Un réseau = une suite de couches. Chaque neurone d'une couche calcule :
 *     sortie = activation( biais + Σ poids[i] × entrée[i] )
 * L'activation (ReLU ou tanh) rend le réseau non linéaire : sans elle, empiler des couches ne
 * servirait à rien. La dernière couche est linéaire (pas d'activation) : elle donne une note brute.
 *
 * Apprendre = ajuster tous les poids pour réduire une erreur (loss) :
 *   1. forward  : on calcule la sortie en gardant les valeurs intermédiaires (trace) ;
 *   2. backward : la rétropropagation calcule, pour chaque poids, dans quel sens et de combien
 *                 il faut le bouger pour réduire l'erreur (le gradient) — de la sortie vers l'entrée ;
 *   3. step     : on déplace chaque poids contre son gradient. Deux « optimiseurs » :
 *        - sgd  : descente de gradient simple : poids ← poids − vitesse × gradient ;
 *        - adam : adapte le pas de CHAQUE poids à l'historique de ses gradients (moyenne et variance) :
 *                 grands pas quand la pente est régulière, petits quand elle est bruitée. Bien plus
 *                 rapide en pratique ; c'est l'optimiseur de presque tous les réseaux modernes.
 * Les gradients s'accumulent sur plusieurs exemples (un « lot », batch) avant chaque step.
 */

const ACTIVATIONS = Object.freeze({
    relu: { f: z => (z > 0 ? z : 0),  df: (z) => (z > 0 ? 1 : 0) },
    tanh: { f: z => Math.tanh(z),      df: (z) => { const t = Math.tanh(z); return 1 - t * t; } },
});

export class NeuralNetwork {
    /**
     * @param {object} options
     * @param {number[]} options.sizes        taille de chaque couche, entrée comprise, ex. [159, 32, 16, 1]
     * @param {'relu'|'tanh'} [options.activation='relu']  activation des couches cachées
     * @param {() => number} [options.rng]   aléatoire pour l'initialisation (graine possible)
     * @param {'sgd'|'adam'} [options.optimizer='sgd']
     */
    constructor({ sizes, activation = 'relu', rng = Math.random, optimizer = 'sgd' }) {
        this.sizes      = [...sizes];
        this.activation = activation;
        this.optimizer  = optimizer;
        this.adamStep   = 0;
        this.weights = [];
        this.biases  = [];
        this.gradW   = [];
        this.gradB   = [];
        this.gradCount = 0;

        for (let l = 0; l < sizes.length - 1; l++) {
            const nIn = sizes[l], nOut = sizes[l + 1];
            // Initialisation « He » : poids aléatoires (loi normale) d'écart-type √(2 / nIn),
            // pour que le signal ne s'éteigne ni n'explose en traversant les couches
            const std = Math.sqrt(2 / nIn);
            this.weights.push(Float64Array.from({ length: nIn * nOut }, () => gaussian(rng) * std));
            this.biases.push(new Float64Array(nOut));
            this.gradW.push(new Float64Array(nIn * nOut));
            this.gradB.push(new Float64Array(nOut));
        }

        // Mémoire d'Adam : moyenne (m) et variance (v) des gradients, pour chaque paramètre
        if (optimizer === 'adam') {
            this.adam = {
                mW: this.weights.map(w => new Float64Array(w.length)), vW: this.weights.map(w => new Float64Array(w.length)),
                mB: this.biases.map(b => new Float64Array(b.length)),  vB: this.biases.map(b => new Float64Array(b.length)),
            };
        }
    }

    // Nombre total de paramètres (poids + biais)
    get parameterCount() {
        return this.weights.reduce((n, w, l) => n + w.length + this.biases[l].length, 0);
    }

    /**
     * Calcule la sortie du réseau.
     * @returns {{ output: Float64Array, activations: Float64Array[], preActivations: Float64Array[] }}
     *          la trace complète, nécessaire à backward()
     */
    forward(input) {
        const act = ACTIVATIONS[this.activation];
        const activations    = [Float64Array.from(input)];
        const preActivations = [];
        const last = this.weights.length - 1;

        for (let l = 0; l <= last; l++) {
            const w = this.weights[l], b = this.biases[l];
            const a = activations[l];
            const nIn = this.sizes[l], nOut = this.sizes[l + 1];
            const z = new Float64Array(nOut);

            for (let o = 0; o < nOut; o++) {
                let sum = b[o];
                const row = o * nIn;
                for (let i = 0; i < nIn; i++) sum += w[row + i] * a[i];
                z[o] = sum;
            }
            preActivations.push(z);
            activations.push(l === last ? z : z.map(act.f));
        }

        return { output: activations[activations.length - 1], activations, preActivations };
    }

    /**
     * Rétropropagation : ajoute aux gradients l'effet d'un exemple.
     * @param {object} trace    résultat de forward() pour cet exemple
     * @param {ArrayLike<number>} outputGradient  dérivée de l'erreur par rapport à chaque sortie
     */
    backward(trace, outputGradient) {
        const act = ACTIVATIONS[this.activation];
        let delta = Float64Array.from(outputGradient); // dérivée de l'erreur par rapport à z (couche linéaire en sortie)

        for (let l = this.weights.length - 1; l >= 0; l--) {
            const w = this.weights[l], gw = this.gradW[l], gb = this.gradB[l];
            const aPrev = trace.activations[l];
            const nIn = this.sizes[l], nOut = this.sizes[l + 1];

            for (let o = 0; o < nOut; o++) {
                const d = delta[o];
                if (d === 0) continue;
                gb[o] += d;
                const row = o * nIn;
                for (let i = 0; i < nIn; i++) gw[row + i] += d * aPrev[i];
            }

            if (l > 0) {
                // Erreur renvoyée à la couche précédente, multipliée par la pente de son activation
                const zPrev = trace.preActivations[l - 1];
                const next  = new Float64Array(nIn);
                for (let i = 0; i < nIn; i++) {
                    let sum = 0;
                    for (let o = 0; o < nOut; o++) sum += w[o * nIn + i] * delta[o];
                    next[i] = sum * act.df(zPrev[i]);
                }
                delta = next;
            }
        }
        this.gradCount++;
    }

    // Mise à jour des poids avec la moyenne des gradients accumulés, puis remise à zéro
    step(learningRate) {
        if (this.gradCount === 0) return;
        const n = this.gradCount;

        if (this.optimizer === 'adam') {
            const b1 = 0.9, b2 = 0.999, eps = 1e-8;
            this.adamStep++;
            const c1 = 1 - b1 ** this.adamStep, c2 = 1 - b2 ** this.adamStep; // correction du démarrage à 0
            const update = (params, grads, m, v) => {
                for (let k = 0; k < params.length; k++) {
                    const g = grads[k] / n;
                    m[k] = b1 * m[k] + (1 - b1) * g;
                    v[k] = b2 * v[k] + (1 - b2) * g * g;
                    params[k] -= learningRate * (m[k] / c1) / (Math.sqrt(v[k] / c2) + eps);
                    grads[k] = 0;
                }
            };
            for (let l = 0; l < this.weights.length; l++) {
                update(this.weights[l], this.gradW[l], this.adam.mW[l], this.adam.vW[l]);
                update(this.biases[l],  this.gradB[l], this.adam.mB[l], this.adam.vB[l]);
            }
        } else {
            const scale = learningRate / n;
            for (let l = 0; l < this.weights.length; l++) {
                const w = this.weights[l], gw = this.gradW[l], b = this.biases[l], gb = this.gradB[l];
                for (let k = 0; k < w.length; k++) { w[k] -= scale * gw[k]; gw[k] = 0; }
                for (let k = 0; k < b.length; k++) { b[k] -= scale * gb[k]; gb[k] = 0; }
            }
        }
        this.gradCount = 0;
    }

    toJSON() {
        return {
            sizes: this.sizes,
            activation: this.activation,
            weights: this.weights.map(w => Array.from(w)),
            biases: this.biases.map(b => Array.from(b)),
        };
    }

    static fromJSON({ sizes, activation, weights, biases }) {
        const net = new NeuralNetwork({ sizes, activation, rng: () => 0.5 });
        weights.forEach((w, l) => net.weights[l].set(w));
        biases.forEach((b, l) => net.biases[l].set(b));
        return net;
    }
}

// Nombre tiré selon une loi normale (moyenne 0, écart-type 1), méthode de Box-Muller
function gaussian(rng) {
    const u = 1 - rng(), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
