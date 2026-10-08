import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/Random.js';
import { store } from '../src/core/Store.js';
import { GeneticAlgorithm } from '../src/AI/Genetic.js';
import { MOVE_FEATURES, moveFeatures, createWeightedMoveAgent } from '../src/AI/MoveFeatures.js';
import { MoveTrainer } from '../src/AI/MoveTrainer.js';
import { TrainingSession } from '../src/AI/TrainingSession.js';
import { setBoard, createWeapon, DECOR } from './helpers.mjs';

afterEach(() => mock.timers.reset());

const feature = (values, key) => values[MOVE_FEATURES.findIndex(f => f.key === key)];
const weightsFor = (entries) => MOVE_FEATURES.map(f => entries[f.key] ?? 0);

// ─── Algorithme génétique ─────────────────────────────────────────────────────

test('the genetic algorithm gets closer to a target genome', () => {
    const target  = [0.8, -0.5, 0.3];
    const fitness = genome => -genome.reduce((sum, g, i) => sum + (g - target[i]) ** 2, 0);
    const ga = new GeneticAlgorithm({ genomeSize: 3, fitness, rng: createRng(1), populationSize: 20 });

    const first = ga.step().best.fitness;
    let last;
    for (let i = 0; i < 40; i++) last = ga.step().best.fitness;

    assert.ok(last > first, `fitness ${first} → ${last}`);
    assert.ok(last > -0.01, `close to the target: ${last}`);
});

test('elitism keeps the best genome in the next generation', () => {
    const ga = new GeneticAlgorithm({ genomeSize: 2, fitness: g => g[0], rng: createRng(2), populationSize: 10, eliteCount: 2 });
    const { best } = ga.step();
    assert.ok(ga.population.some(g => g[0] === best.genome[0] && g[1] === best.genome[1]));
});

test('the genetic algorithm is reproducible with the same seed', () => {
    const run = () => {
        const ga = new GeneticAlgorithm({ genomeSize: 4, fitness: g => g[0] + g[1], rng: createRng(5), populationSize: 8 });
        for (let i = 0; i < 5; i++) ga.step();
        return ga.population;
    };
    assert.deepEqual(run(), run());
});

// ─── Caractéristiques du déplacement ──────────────────────────────────────────

test('a duel cell gives an advantage when I strike first with more power', () => {
    setBoard({ players: [
        { row: 0, col: 0, weapon: createWeapon('w40', 40, 'w.png') },
        { row: 0, col: 3, health: 80 },
    ] });
    const values = moveFeatures(store.state, store.state.cells[0][2]);
    assert.equal(feature(values, 'duel'), 1);
    assert.ok(feature(values, 'duelAdvantage') > 0, 'I kill in 2 hits, he needs 10');
});

test('a cell within the enemy reach is marked as exposed, and dangerous if he is stronger', () => {
    setBoard({
        rows: 7, cols: 7,
        players: [
            { row: 6, col: 0, health: 30 },
            { row: 2, col: 4, weapon: createWeapon('w40', 40, 'w.png'), maxMove: 3 },
        ],
    });
    // En (6,4), l'ennemi (2,4) peut descendre jusqu'en (5,4), juste à côté → exposé
    const exposed = moveFeatures(store.state, store.state.cells[6][4]);
    assert.equal(feature(exposed, 'exposed'), 1);
    assert.ok(feature(exposed, 'exposedDanger') > 0, 'he kills me in 1 hit, I need 3');

    // En (6,1), aucune case qu'il peut atteindre n'est voisine → pas exposé
    assert.equal(feature(moveFeatures(store.state, store.state.cells[6][1]), 'exposed'), 0);
});

test('hidden traps are never used by the features', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    const plain = moveFeatures(store.state, store.state.cells[0][1]);
    setBoard({
        players: [{ row: 0, col: 0 }, { row: 4, col: 4 }],
        setup: cells => { cells[0][1].trap = { name: 'trap1', image: 'trap1.png', triggered: false }; },
    });
    assert.deepEqual(moveFeatures(store.state, store.state.cells[0][1]), plain);
});

test('the weighted agent goes to the best scored cell', () => {
    setBoard({
        players: [{ row: 0, col: 0 }, { row: 4, col: 4 }],
        setup: cells => { cells[0][2].weapon = createWeapon('Excalibur', 40, 'e.png'); cells[1][1].decor = DECOR.OBSTACLE; },
    });
    const weaponLover = createWeightedMoveAgent(weightsFor({ weaponGain: 1 }));
    assert.deepEqual(
        (({ row, col }) => ({ row, col }))(weaponLover.chooseMove(store.state)),
        { row: 0, col: 2 },
    );
});

// ─── Entraînement ─────────────────────────────────────────────────────────────

test('evolution improves the movement against the normal AI', () => {
    const trainer = new MoveTrainer({ seed: 1, gamesPerIndividual: 30, gaOptions: { populationSize: 12 } });
    const before = trainer.evaluate(200, trainer.population[0]).winRate;
    for (let g = 0; g < 8; g++) trainer.nextGeneration();
    const after = trainer.evaluate(200).winRate;

    assert.equal(trainer.generation, 8);
    assert.equal(trainer.gamesPlayed, 8 * 12 * 30);
    assert.ok(after > before, `win rate ${before} → ${after}`);
});

test('the movement lesson runs generations in the training session and exports its weights', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const messages = [];
    const session = new TrainingSession(m => {
        messages.push(m);
        if (m.type === 'stats' && m.running && m.gamesPlayed > 0) session.pause();
    }, { lesson: 'move' });

    assert.equal(messages.at(-1).progress.label, 'générations');
    assert.equal(messages.at(-1).history.length, 1, 'starting point of the curve');

    session.setSpeed('turbo');
    session.start();
    mock.timers.tick(0);

    const stats = messages.filter(m => m.type === 'stats').at(-1);
    assert.equal(stats.lesson, 'move');
    assert.ok(Number(stats.progress.value) >= 1);
    assert.equal(stats.weights.length, MOVE_FEATURES.length);

    session.exportModel();
    const model = messages.at(-1);
    assert.equal(model.lesson, 'move');
    assert.equal(model.model.weights.length, MOVE_FEATURES.length);
});
