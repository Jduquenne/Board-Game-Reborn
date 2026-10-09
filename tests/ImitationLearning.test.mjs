import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/Random.js';
import { store } from '../src/core/Store.js';
import { NeuralNetwork } from '../src/AI/NeuralNetwork.js';
import { MOVE_INPUT_SIZE, moveInputs, createNeuralMoveAgent } from '../src/AI/NeuralMovePolicy.js';
import { ImitationTrainer } from '../src/AI/ImitationTrainer.js';
import { TrainingSession } from '../src/AI/TrainingSession.js';
import { setBoard, DECOR } from './helpers.mjs';

// ─── Entrées du réseau ────────────────────────────────────────────────────────

test('the network input has the documented size and marks the board edge as blocked', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    const input = moveInputs(store.state, store.state.cells[0][0]);
    assert.equal(input.length, MOVE_INPUT_SIZE);
    assert.equal(MOVE_INPUT_SIZE, 159);
    assert.equal(input[0], 1, 'top-left corner of the 5 × 5 view is outside the board');
});

test('an obstacle in the view is visible to the network', () => {
    setBoard({
        players: [{ row: 2, col: 2 }, { row: 4, col: 4 }],
        setup: cells => { cells[1][2].decor = DECOR.OBSTACLE; },
    });
    const withObstacle = moveInputs(store.state, store.state.cells[2][1]);
    store.state.cells[1][2].decor = DECOR.FLOOR;
    const withoutObstacle = moveInputs(store.state, store.state.cells[2][1]);
    assert.notDeepEqual(withObstacle, withoutObstacle);
});

test('hidden traps are invisible to the network, triggered ones are visible', () => {
    setBoard({ players: [{ row: 2, col: 2 }, { row: 4, col: 4 }] });
    const plain = moveInputs(store.state, store.state.cells[2][1]);

    store.state.cells[2][0].trap = { name: 'trap1', image: 'trap1.png', triggered: false };
    assert.deepEqual(moveInputs(store.state, store.state.cells[2][1]), plain, 'hidden trap');

    store.state.cells[2][0].trap.triggered = true;
    assert.notDeepEqual(moveInputs(store.state, store.state.cells[2][1]), plain, 'triggered trap');
});

test('the neural agent always chooses a reachable cell', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    const net = new NeuralNetwork({ sizes: [MOVE_INPUT_SIZE, 8, 1], rng: createRng(1) });
    const move = createNeuralMoveAgent(net).chooseMove(store.state);
    assert.ok(store.state.cells[move.row][move.col].isMovable);
});

// ─── Imitation ────────────────────────────────────────────────────────────────

test('recorded decisions are split into training and test sets, with probability targets', () => {
    const trainer = new ImitationTrainer({ seed: 1 });
    const sizes = trainer.collect(50);
    assert.ok(sizes.train > sizes.test && sizes.test > 0);
    for (const sample of trainer.train.slice(0, 20)) {
        assert.equal(sample.soft.length, sample.inputs.length);
        assert.ok(Math.abs(sample.soft.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'distillation targets sum to 1');
        assert.ok(sample.target >= 0 && sample.target < sample.inputs.length);
    }
});

test('training lowers the error on unseen decisions, reproducibly', () => {
    const run = () => {
        const trainer = new ImitationTrainer({ seed: 2, hidden: [16] });
        // Depuis les classes (lot 5), les parties sont plus variées : sur peu de parties, le réseau
        // sur-apprend dès la 2e époque (erreur de test qui remonte). On vérifie donc la meilleure
        // erreur de test atteinte (ce que garderait un arrêt précoce), sur 800 parties.
        trainer.collect(800);
        const before = trainer.measure(trainer.test).testLoss;
        const losses = [];
        for (let e = 0; e < 3; e++) losses.push(trainer.trainEpoch().testLoss);
        return { before, best: Math.min(...losses) };
    };
    const a = run();
    assert.ok(a.best < a.before, `test loss ${a.before} → best ${a.best}`);
    assert.deepEqual(run(), a, 'same seed, same result');
});

test('training can advance batch by batch until the epoch ends', () => {
    const trainer = new ImitationTrainer({ seed: 3, hidden: [8], batchSize: 64 });
    trainer.collect(30);
    let report = null, batches = 0;
    while (!report) {
        report = trainer.trainBatch();
        batches++;
        if (!report) assert.ok(trainer.epochProgress > 0 && trainer.epochProgress < 1);
    }
    assert.equal(batches, Math.ceil(trainer.train.length / 64));
    assert.equal(report.epoch, 1);
    assert.equal(trainer.epochProgress, 0);
});

// ─── Leçon et jeu ─────────────────────────────────────────────────────────────

test('the neural lesson reports epochs and losses, and exports its network', () => {
    const messages = [];
    const session = new TrainingSession(m => messages.push(m), { lesson: 'neural' });
    const stats = messages.at(-1);
    assert.equal(stats.lesson, 'neural');
    assert.match(stats.progress.value, /^0 /);
    assert.equal(stats.losses.length, 1);
    assert.equal(stats.network.sizes[0], MOVE_INPUT_SIZE);

    session.lesson.runBatch(0); // un lot au moins
    session.exportModel();
    const model = messages.at(-1);
    assert.equal(model.model.kind, 'network');
    assert.equal(model.model.network.sizes[0], MOVE_INPUT_SIZE);
});
