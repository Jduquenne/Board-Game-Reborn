import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/Random.js';
import { NeuralNetwork } from '../src/AI/NeuralNetwork.js';

// Erreur quadratique d'une sortie scalaire
const squaredError = (net, x, target) => (net.forward(x).output[0] - target) ** 2;

test('a network has the expected shape and number of parameters', () => {
    const net = new NeuralNetwork({ sizes: [3, 4, 2], rng: createRng(1) });
    assert.equal(net.forward([1, 2, 3]).output.length, 2);
    assert.equal(net.parameterCount, 3 * 4 + 4 + 4 * 2 + 2);
});

// LE test d'un réseau : la rétropropagation doit donner les mêmes pentes que le calcul numérique
// (on bouge un poids d'un tout petit epsilon et on regarde comment l'erreur change)
for (const activation of ['tanh', 'relu']) {
    test(`backpropagation matches numerical gradients (${activation})`, () => {
        const net = new NeuralNetwork({ sizes: [3, 5, 4, 1], activation, rng: createRng(7) });
        const x = [0.3, -0.8, 0.5], target = 0.7;

        const trace = net.forward(x);
        net.backward(trace, [2 * (trace.output[0] - target)]);

        const eps = 1e-6;
        for (let l = 0; l < net.weights.length; l++) {
            for (const k of [0, net.weights[l].length - 1, Math.floor(net.weights[l].length / 2)]) {
                const original = net.weights[l][k];
                net.weights[l][k] = original + eps;
                const plus = squaredError(net, x, target);
                net.weights[l][k] = original - eps;
                const minus = squaredError(net, x, target);
                net.weights[l][k] = original;

                const numerical = (plus - minus) / (2 * eps);
                assert.ok(Math.abs(numerical - net.gradW[l][k]) < 1e-5,
                    `layer ${l} weight ${k}: numerical ${numerical} vs backprop ${net.gradW[l][k]}`);
            }
        }
    });
}

test('a hidden layer learns XOR (impossible for a single neuron)', () => {
    const data = [[[0, 0], 0], [[0, 1], 1], [[1, 0], 1], [[1, 1], 0]];
    const net = new NeuralNetwork({ sizes: [2, 8, 1], activation: 'tanh', rng: createRng(3) });
    const loss = () => data.reduce((sum, [x, y]) => sum + squaredError(net, x, y), 0) / data.length;

    const before = loss();
    for (let epoch = 0; epoch < 2000; epoch++) {
        for (const [x, y] of data) {
            const trace = net.forward(x);
            net.backward(trace, [2 * (trace.output[0] - y)]);
        }
        net.step(0.1);
    }

    assert.ok(loss() < 0.01, `loss ${before} → ${loss()}`);
    for (const [x, y] of data) assert.equal(Math.round(net.forward(x).output[0]), y);
});

test('step averages the accumulated gradients and resets them', () => {
    const net = new NeuralNetwork({ sizes: [1, 1], rng: createRng(1) });
    net.weights[0][0] = 1;
    net.backward(net.forward([1]), [1]);
    net.backward(net.forward([1]), [3]);
    net.step(0.5);                                  // gradient moyen = 2 → poids 1 − 0.5 × 2 = 0
    assert.equal(net.weights[0][0], 0);
    assert.equal(net.gradW[0][0], 0);
    assert.equal(net.gradCount, 0);
});

test('a network survives a JSON round trip', () => {
    const net  = new NeuralNetwork({ sizes: [4, 3, 1], rng: createRng(2) });
    const copy = NeuralNetwork.fromJSON(JSON.parse(JSON.stringify(net.toJSON())));
    assert.deepEqual(Array.from(copy.forward([1, 0, -1, 0.5]).output), Array.from(net.forward([1, 0, -1, 0.5]).output));
});

test('the Adam optimizer learns XOR much faster than plain gradient descent', () => {
    const data = [[[0, 0], 0], [[0, 1], 1], [[1, 0], 1], [[1, 1], 0]];
    const train = (optimizer, lr, epochs) => {
        const net = new NeuralNetwork({ sizes: [2, 8, 1], activation: 'tanh', rng: createRng(3), optimizer });
        for (let epoch = 0; epoch < epochs; epoch++) {
            for (const [x, y] of data) {
                const trace = net.forward(x);
                net.backward(trace, [2 * (trace.output[0] - y)]);
            }
            net.step(lr);
        }
        return data.reduce((sum, [x, y]) => sum + squaredError(net, x, y), 0) / data.length;
    };
    const sgd  = train('sgd', 0.1, 200);
    const adam = train('adam', 0.05, 200);
    assert.ok(adam < 0.01, `adam loss after 200 epochs: ${adam}`);
    assert.ok(adam < sgd / 5, `adam ${adam} vs sgd ${sgd}`);
});
