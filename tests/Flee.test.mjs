import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { fleeChance, fleeDestination, applyFlee } from '../src/Engine/Rules.js';
import { fightEngine } from '../src/Engine/FightEngine.js';
import { GameEnv } from '../src/AI/GameEnv.js';
import { createRng } from '../src/core/Random.js';
import { setBoard, setFight, recordEvents, createWeapon, DECOR } from './helpers.mjs';

let events;
beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
afterEach(() => { mock.timers.reset(); events?.stop(); });

// Combat : le joueur 0 (en (0,0), 3 PM) doit jouer contre le joueur 1 (en (0,1)), plateau 5 × 5
function fightState({ fleer = {}, enemy = {}, setup } = {}) {
    setBoard({ players: [{ row: 0, col: 0, ...fleer }, { row: 0, col: 1, ...enemy }], setup });
    setFight(0, 1);
    return store.state;
}

// ─── Chance de fuir ───────────────────────────────────────────────────────────

test('flee chance = (Luck + 2) / (Luck + enemy tackle + 4), as in the spec table', () => {
    const chance = (luck, agility) => fleeChance({ luck }, { agility });
    assert.equal(chance(5, 5), 0.5);
    assert.equal(chance(10, 2), 0.75);
    assert.equal(chance(2, 10), 0.25);
    assert.equal(chance(0, 0), 0.5);
    assert.equal(fleeChance({}, {}), 0.5, 'missing stats count as 0');
});

test('flee chance is clamped between 10 % and 90 %', () => {
    assert.equal(fleeChance({ luck: 0 }, { agility: 50 }), 0.1);
    assert.equal(fleeChance({ luck: 50 }, { agility: 0 }), 0.9);
});

// ─── Case de repli ────────────────────────────────────────────────────────────

test('the escape cell is the reachable cell farthest from the enemy', () => {
    const state = fightState();
    // Depuis (0,0), avec 3 PM : (1,0) (2,0) (3,0) — la droite est bloquée par l'ennemi ; la plus loin de (0,1) : (3,0)
    assert.deepEqual((({ row, col }) => ({ row, col }))(fleeDestination(state)), { row: 3, col: 0 });
});

test('there is no escape cell when the fighter is cornered', () => {
    const state = fightState({ setup: cells => { cells[1][0].decor = DECOR.OBSTACLE; } });
    assert.equal(fleeDestination(state), null);
    assert.equal(applyFlee(state, () => 0).state, state, 'flee refused');
});

test('a cell next to the enemy is never an escape cell', () => {
    // Seule case accessible : (1,0)… qui n'est pas collée à l'ennemi (0,1)? distance 2 → autorisée.
    // On place l'ennemi en (1,1) : (1,0) devient voisine → plus de repli possible
    setBoard({
        players: [{ row: 0, col: 0, maxMove: 1 }, { row: 1, col: 1 }],
        setup: cells => { cells[0][1].decor = DECOR.OBSTACLE; },
    });
    setFight(0, 1);
    assert.equal(fleeDestination(store.state), null);
});

// ─── Réussite / échec ─────────────────────────────────────────────────────────

test('a successful flee ends the fight, moves the fleer away and gives the turn to the enemy', () => {
    const { state, events: emitted } = applyFlee(fightState({ fleer: { defense: true } }), () => 0); // 0 < 50 %
    assert.equal(state.phase, 'playing');
    assert.equal(state.fight, null);
    assert.deepEqual(state.players[0].position, { row: 3, col: 0 });
    assert.equal(state.activePlayerIndex, 1);
    assert.equal(state.players[0].player.defense, false, 'defenses reset when the fight ends');
    assert.deepEqual(emitted.map(e => e.name), ['fight:flee', 'turn:changed']);
    assert.deepEqual([emitted[0].payload.success, emitted[0].payload.chance], [true, 0.5]);
});

test('a failed flee keeps the fight going', () => {
    const before = fightState();
    const { state, events: emitted } = applyFlee(before, () => 0.99);
    assert.notEqual(state, before, 'the action is played');
    assert.equal(state.phase, 'fighting');
    assert.deepEqual(state.players[0].position, { row: 0, col: 0 });
    assert.equal(emitted[0].payload.success, false);
});

test('fleeing onto a weapon picks it up, like a normal move', () => {
    const { state } = applyFlee(fightState({ setup: cells => { cells[3][0].weapon = createWeapon('Excalibur', 40, 'e.png'); } }), () => 0);
    assert.equal(state.players[0].player.weapon.name, 'Excalibur');
});

test('in the game: a failed flee gives the enemy the next action', () => {
    fightState();
    mock.method(Math, 'random', () => 0.99);
    events = recordEvents(['fight:flee', 'fight:round-end']);

    fightEngine.flee();
    mock.timers.tick(500);

    assert.deepEqual(events.names(), ['fight:flee', 'fight:round-end']);
    assert.deepEqual(store.state.fight, { attackerIndex: 1, targetIndex: 0 });
    mock.restoreAll();
});

test('in the game: a successful flee ends the fight without a round end', () => {
    fightState();
    mock.method(Math, 'random', () => 0);
    events = recordEvents(['fight:flee', 'fight:round-end', 'turn:changed']);

    fightEngine.flee();
    mock.timers.tick(1000);

    assert.deepEqual(events.names(), ['fight:flee', 'turn:changed']);
    assert.equal(store.state.phase, 'playing');
    mock.restoreAll();
});

// ─── Simulateur ───────────────────────────────────────────────────────────────

test('the simulator accepts the flee action', () => {
    const env = new GameEnv({ rng: createRng(1) });
    env.reset();
    env.state = fightState();

    const { accepted, events: emitted } = env.step({ type: 'flee' });
    assert.equal(accepted, true);
    const flee = emitted.find(e => e.name === 'fight:flee');
    assert.ok(flee);
    if (flee.payload.success) assert.equal(env.state.phase, 'playing');
    else assert.deepEqual(env.state.fight, { attackerIndex: 1, targetIndex: 0 }, 'round resolved: roles swapped');
});
