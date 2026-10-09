import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import {
    initiative, firstPlayerIndex, createGame, applyPass, applyMove,
    suddenDeathDamage, SUDDEN_DEATH_TURN,
} from '../src/Engine/Rules.js';
import { createRng } from '../src/core/Random.js';
import { runBalance } from '../src/AI/Balance.js';
import { setBoard } from './helpers.mjs';

// ─── Lot 6 : initiative (docs/spec-game-design.md §8, option A) ──────────────

const info = player => ({ player: { maxMove: 3, agility: 0, luck: 0, ...player } });
const fixedRng = value => {
    const rng = () => { rng.calls++; return value; };
    rng.calls = 0;
    return rng;
};

test('initiative = agility + luck + 2 × PM', () => {
    assert.equal(initiative({ agility: 2, luck: 6, maxMove: 5 }), 18);
    assert.equal(initiative({ maxMove: 2 }), 4, 'missing stats count as 0');
});

test('the character with the higher initiative plays first, without a random draw', () => {
    const rng = fixedRng(0);
    assert.equal(firstPlayerIndex([info({ maxMove: 2 }), info({ maxMove: 5 })], rng), 1);
    assert.equal(firstPlayerIndex([info({ luck: 3 }), info({ agility: 2 })], rng), 0);
    assert.equal(rng.calls, 0);
});

test('a tie is decided by a coin flip', () => {
    const tie = [info({}), info({})];
    assert.equal(firstPlayerIndex(tie, fixedRng(0.2)), 0);
    assert.equal(firstPlayerIndex(tie, fixedRng(0.7)), 1);
});

test('a new game starts with the higher initiative, stores it on the players, at turn 0', () => {
    for (let seed = 1; seed <= 20; seed++) {
        const state = createGame({ rows: 8, cols: 8, nbObstacles: 4, nbWeapons: 2, nbBonus: 1, nbTraps: 1, aiMode: 'none' }, createRng(seed));
        const [a, b] = state.players.map(p => p.player.initiative);
        assert.deepEqual([a, b], state.players.map(p => initiative(p.player)));
        if (a !== b) assert.equal(state.activePlayerIndex, a > b ? 0 : 1, `seed ${seed}`);
        assert.equal(state.turn, 0);
    }
});

// ─── Lot 6 : mort subite (anti-blocage) ───────────────────────────────────────

test('sudden death: nothing before turn 80, then 5 HP, +5 every 20 turns', () => {
    assert.equal(SUDDEN_DEATH_TURN, 80);
    assert.deepEqual([1, 79, 80, 99, 100, 120, 140].map(suddenDeathDamage), [0, 0, 5, 5, 10, 15, 20]);
});

const board = ({ turn, health = 100 }) => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4, health }] });
    store.setState(() => ({ turn }));
    return store.state;
};

test('every turn played is counted', () => {
    const { state } = applyPass(board({ turn: 10 }));
    assert.equal(state.turn, 11);
    const moved = applyMove(state, 4, 1); // le joueur 1 descend vers la case libre (4,1)
    assert.equal(moved.state.turn, 12);
});

test('from turn 80, the player starting their turn loses health', () => {
    const before = applyPass(board({ turn: 78 }));
    assert.equal(before.state.players[1].player.health, 100, 'turn 79: no damage');

    const { state, events } = applyPass(board({ turn: 79 }));
    assert.equal(state.players[1].player.health, 95);
    assert.equal(state.cells[4][4].player.health, 95, 'the cell shows the same player');
    assert.equal(state.phase, 'playing');
    assert.deepEqual(events.map(e => e.name), ['sudden-death:hit', 'turn:changed']);
    assert.equal(events[0].payload.damage, 5);
});

test('sudden death can end the game', () => {
    const { state, events } = applyPass(board({ turn: 99, health: 10 })); // tour 100 : 10 PV perdus
    assert.equal(state.phase, 'gameover');
    assert.equal(state.players[1].player.health, 0);
    assert.deepEqual(events.map(e => e.name), ['sudden-death:hit', 'game:over']);
    assert.equal(events[1].payload.winner.player, state.players[0].player);
    assert.equal(events[1].payload.reason, 'sudden-death');
});

test('two cautious players no longer draw: sudden death ends the game', () => {
    const char = (name, maxMove) => ({ name, health: 100, maxMove, image: `${name}.png` });
    // Agent qui ne bouge jamais : sans mort subite, toutes les parties finissaient en match nul
    const passive = { name: 'passive', chooseMove: () => null, chooseFightAction: () => 'defend' };
    const result = runBalance({ characters: [char('A', 3), char('B', 3)], agent: passive, gamesPerPair: 10 });
    assert.equal(result.drawRate, 0);
});
