import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { fightEngine } from '../src/Engine/FightEngine.js';
import { setBoard, setFight, recordEvents, createWeapon } from './helpers.mjs';

// Délai entre une action et la vérification de victoire dans FightEngine
const VICTORY_CHECK_DELAY = 500;

let events;

beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] });
    events = recordEvents(['fight:attack', 'fight:defend', 'fight:round-end', 'fight:end']);
});

afterEach(() => {
    mock.timers.reset();
    events.stop();
});

function startFight({ attacker = {}, target = {} } = {}) {
    setBoard({ players: [{ row: 0, col: 0, ...attacker }, { row: 0, col: 1, ...target }] });
    setFight(0, 1);
}

test('attack deals the weapon damage to the target', () => {
    startFight({ attacker: { weapon: createWeapon('Hurlesang', 35, 'h.png') }, target: { health: 100 } });

    fightEngine.attack();

    assert.equal(store.state.players[1].player.health, 65);
    assert.equal(events.log[0].name, 'fight:attack');
    assert.equal(events.log[0].payload.damage, 35);
});

test('defense halves the damage (rounded down) and is consumed', () => {
    startFight({
        attacker: { weapon: createWeapon('Skyword', 15, 's.png'), defense: true },
        target:   { health: 100, defense: true },
    });

    fightEngine.attack();

    const [attacker, target] = store.state.players;
    assert.equal(target.player.health, 93);
    assert.equal(events.log[0].payload.damage, 7);
    assert.equal(target.player.defense, false);
    assert.equal(attacker.player.defense, false);
});

test('roles swap after an action when nobody is dead', () => {
    startFight();
    fightEngine.attack();

    assert.deepEqual(store.state.fight, { attackerIndex: 0, targetIndex: 1 }, 'not before the delay');
    mock.timers.tick(VICTORY_CHECK_DELAY);

    assert.equal(store.state.phase, 'fighting');
    assert.deepEqual(store.state.fight, { attackerIndex: 1, targetIndex: 0 });
    const roundEnd = events.log.find(e => e.name === 'fight:round-end');
    assert.equal(roundEnd.payload.nextAttacker, store.state.players[1]);
});

test('defend puts the attacker in defense and passes the turn', () => {
    startFight();
    fightEngine.defend();

    assert.equal(store.state.players[0].player.defense, true);
    assert.equal(store.state.players[1].player.health, 100);
    assert.equal(events.log[0].name, 'fight:defend');

    mock.timers.tick(VICTORY_CHECK_DELAY);
    assert.deepEqual(store.state.fight, { attackerIndex: 1, targetIndex: 0 });
});

test('a lethal hit ends the game', () => {
    startFight({ attacker: { weapon: createWeapon('Excalibur', 40, 'e.png') }, target: { health: 30 } });

    fightEngine.attack();
    mock.timers.tick(VICTORY_CHECK_DELAY);

    const { phase, fight, players } = store.state;
    assert.equal(players[1].player.health, 0, 'health never goes below 0');
    assert.equal(phase, 'gameover');
    assert.equal(fight, null);
    const end = events.log.find(e => e.name === 'fight:end');
    assert.equal(end.payload.winner, players[0]);
    assert.equal(end.payload.loser, players[1]);
    assert.ok(!events.names().includes('fight:round-end'));
});

test('actions are ignored outside a fight', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 0, col: 1 }] });

    fightEngine.attack();
    fightEngine.defend();

    assert.equal(store.state.players[1].player.health, 100);
    assert.equal(events.log.length, 0);
});
