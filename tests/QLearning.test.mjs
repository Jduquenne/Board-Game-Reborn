import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { QTable } from '../src/AI/QLearning.js';
import { fightStateKey, describeFightKey, createQFightAgent, FIGHT_ACTIONS } from '../src/AI/FightPolicy.js';
import { FightTrainer } from '../src/AI/FightTrainer.js';
import { TrainingSession } from '../src/AI/TrainingSession.js';
import { ModelStorage } from '../src/core/ModelStorage.js';
import { store } from '../src/core/Store.js';
import { setBoard, setFight, createWeapon } from './helpers.mjs';

afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
});

// ─── QTable ───────────────────────────────────────────────────────────────────

test('a new situation starts with the initial value for every action', () => {
    const q = new QTable({ actions: ['a', 'b'], initialValue: () => 0.5 });
    assert.deepEqual(q.values('s'), [0.5, 0.5]);
    assert.equal(q.size, 1);
});

test('best returns the highest value, the first action on a tie', () => {
    const q = new QTable({ actions: ['a', 'b'] });
    assert.equal(q.best('s'), 'a');
    q.values('s')[1] = 1;
    assert.equal(q.best('s'), 'b');
});

test('update applies the Q-learning formula', () => {
    const q = new QTable({ actions: ['a', 'b'], alpha: 0.5, gamma: 0.9 });

    q.update('s', 'a', 1, null);                     // fin de partie : cible = récompense
    assert.equal(q.values('s')[0], 0.5);

    q.values('next')[1] = 2;                          // max Q(s') = 2
    q.update('s', 'b', 0, 'next');                   // cible = 0 + 0.9 × 2 = 1.8
    assert.equal(q.values('s')[1], 0.9);
});

test('choose explores with probability epsilon, exploits otherwise', () => {
    const q = new QTable({ actions: ['a', 'b'], epsilon: 0.3 });
    q.values('s')[1] = 1;                             // meilleure action : b
    assert.equal(q.choose('s', () => 0.5), 'b', 'random draw above epsilon → best action');

    const draws = [0.1, 0.0];                         // 0.1 < epsilon → exploration, puis action index 0
    assert.equal(q.choose('s', () => draws.shift()), 'a');
});

test('epsilon decays down to its minimum', () => {
    const q = new QTable({ actions: ['a'], epsilon: 0.1, epsilonMin: 0.05, epsilonDecay: 0.5 });
    q.decayEpsilon();
    assert.equal(q.epsilon, 0.05);
    q.decayEpsilon();
    assert.equal(q.epsilon, 0.05);
});

test('a table survives a JSON round trip (without exploration)', () => {
    const q = new QTable({ actions: ['a', 'b'] });
    q.update('s', 'b', 1, null);
    const copy = QTable.fromJSON(JSON.parse(JSON.stringify(q.toJSON())));
    assert.deepEqual(copy.entries(), q.entries());
    assert.equal(copy.epsilon, 0);
    assert.equal(copy.best('s'), 'b');
});

// ─── Observation du combat ────────────────────────────────────────────────────

function fightState({ attacker = {}, target = {} } = {}) {
    setBoard({ players: [{ row: 0, col: 0, ...attacker }, { row: 0, col: 1, ...target }] });
    setFight(0, 1);
    return store.state;
}

test('the fight key counts the hits needed by each side and the defenses', () => {
    const state = fightState({
        attacker: { health: 100, weapon: createWeapon('w40', 40, 'w.png'), defense: true },
        target:   { health: 100, weapon: createWeapon('w10', 10, 'w.png') },
    });
    assert.equal(fightStateKey(state), '3|10|1|0|5', 'flee possible with 50 % (no Luck, no tackle)');
});

test('the number of hits is capped at 10', () => {
    const state = fightState({ attacker: { weapon: createWeapon('w1', 1, 'w.png') } });
    assert.equal(fightStateKey(state).split('|')[0], '10');
});

test('a fight key has a readable description', () => {
    const d = describeFightKey('1|10|0|1');
    assert.equal(d.myHits, 1);
    assert.equal(d.enemyDefense, true);
    assert.match(d.text, /1 coup, il me tue en 10\+ coups · il est en défense/);
});

test('the trained agent plays the best action of its table', () => {
    const q = new QTable({ actions: FIGHT_ACTIONS });
    const state = fightState();
    q.values(fightStateKey(state))[1] = 1;           // défense meilleure
    assert.equal(createQFightAgent(q).chooseFightAction(state, Math.random), 'defend');
});

// ─── Entraînement ─────────────────────────────────────────────────────────────

test('training is reproducible with the same seed', () => {
    const a = new FightTrainer({ seed: 3 });
    const b = new FightTrainer({ seed: 3 });
    a.train(300);
    b.train(300);
    assert.deepEqual(a.qtable.entries(), b.qtable.entries());
    assert.deepEqual(a.results, b.results);
});

test('a training game can be played step by step and returns the outcome', () => {
    const trainer = new FightTrainer({ seed: 1 });
    const game = trainer.trainingGame();
    const first = game.next().value;
    assert.ok(first.state.cells, 'yields the initial state');

    let step = game.next();
    while (!step.done) step = game.next();
    assert.ok(['win', 'loss', 'draw'].includes(step.value));
    assert.equal(trainer.gamesPlayed, 1);
});

// Depuis les classes (lot 5 : esquives, critiques, fuites plus fréquentes), il faut 20 000 parties
// pour une nette progression (≈ 41–44 %) ; l'élève atteint la règle de l'IA Normal (≈ 49 %) vers
// 100 000 parties avec γ = 1 (lot 7) — trop long pour un test.
test('the AI learns to fight (attack, defend, flee): clear progress from random fights', () => {
    const trainer = new FightTrainer({ seed: 1 });
    const before = trainer.evaluate(400).winRate;
    trainer.train(20000);
    const after = trainer.evaluate(400).winRate;

    // ≈ 15 % depuis le critique ×2 (lot 9) : les combats sont un peu plus aléatoires
    assert.ok(before < 0.2, `untrained win rate ${before}`);
    assert.ok(after > 0.3, `trained win rate ${after}`);
});

// ─── Session de la page d'entraînement ────────────────────────────────────────

test('a new session sends its stats with the first evaluation and the reference', () => {
    const messages = [];
    new TrainingSession(m => messages.push(m));
    const stats = messages.at(-1);
    assert.equal(stats.type, 'stats');
    assert.equal(stats.gamesPlayed, 0);
    assert.equal(stats.history.length, 1);
    assert.ok(stats.reference > 0.4 && stats.reference < 0.6);
});

test('at a watching speed the session sends board frames', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const messages = [];
    const session = new TrainingSession(m => messages.push(m));
    session.setSpeed('fast');
    session.start();
    mock.timers.tick(50);
    mock.timers.tick(50);
    assert.ok(messages.some(m => m.type === 'frame' && m.state.cells), 'frames with the game state');
    session.pause();
});

test('at turbo speed the session plays many games per tick, and pause stops it', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    // Pause dès le premier lot de parties (sinon les tics à 0 ms s'enchaînent sans fin avec les faux timers)
    const session = new TrainingSession(m => {
        if (m.type === 'stats' && m.running && m.gamesPlayed > 0) session.pause();
    });
    session.setSpeed('turbo');
    session.start();
    mock.timers.tick(0);

    const played = session.trainer.gamesPlayed;
    assert.ok(played > 1, `games played in one tick: ${played}`);
    assert.equal(session.running, false);
    mock.timers.tick(1000);
    assert.equal(session.trainer.gamesPlayed, played, 'nothing more after the pause');
});

test('the session exports its model', () => {
    const messages = [];
    const session = new TrainingSession(m => messages.push(m));
    session.exportModel();
    const model = messages.at(-1);
    assert.equal(model.type, 'model');
    assert.deepEqual(model.model.actions, FIGHT_ACTIONS);
});

test('model storage fails safely without a browser', () => {
    assert.equal(ModelStorage.save('fight', {}), false);
    assert.equal(ModelStorage.load('fight'), null);
    assert.equal(ModelStorage.load('move'), null);
});

// Lot 7 : γ = 1 pour le combat — avec γ = 0,95, les victoires lointaines (après une fuite ou une
// défense) étaient sous-estimées et l'élève plafonnait sous l'IA Normal
test('fight training does not discount future rewards (gamma = 1)', () => {
    assert.equal(new FightTrainer({ seed: 1 }).qtable.gamma, 1);
});
