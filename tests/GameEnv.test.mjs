import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { createRng } from '../src/core/Random.js';
import { GameEnv } from '../src/AI/GameEnv.js';
import { playGame, runMatch } from '../src/AI/Arena.js';
import { randomAgent, normalAgent } from '../src/AI/ScriptedAgents.js';
import { setBoard, setFight, createWeapon } from './helpers.mjs';

// Place l'état construit par les helpers (dans le Store) dans un environnement
function envFrom(options) {
    setBoard(options);
    const env = new GameEnv({ rng: createRng(1) });
    env.reset();
    env.state = store.state;
    return env;
}

// ─── Environnement ────────────────────────────────────────────────────────────

test('reset starts a new game in the playing phase', () => {
    const env = new GameEnv({ rng: createRng(1) });
    const state = env.reset();
    assert.equal(state.phase, 'playing');
    assert.equal(state.players.length, 2);
    assert.equal(env.turns, 0);
    assert.equal(env.done, false);
    // Qui commence dépend de l'initiative des personnages tirés (lot 6)
    const [a, b] = state.players.map(p => p.player.initiative);
    if (a !== b) assert.equal(env.currentPlayerIndex, a > b ? 0 : 1);
});

test('the same seed generates the same board', () => {
    const a = new GameEnv({ rng: createRng(42) }).reset();
    const b = new GameEnv({ rng: createRng(42) }).reset();
    const c = new GameEnv({ rng: createRng(43) }).reset();
    const layout = s => JSON.stringify(s.cells.map(row => row.map(cell => [cell.decor, cell.weapon?.name, cell.bonus?.name, cell.player?.name])));
    assert.equal(layout(a), layout(b));
    assert.notEqual(layout(a), layout(c));
});

test('an illegal action is refused and changes nothing', () => {
    const env = envFrom({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    const before = env.state;
    const result = env.step({ type: 'move', row: 3, col: 3 });
    assert.equal(result.accepted, false);
    assert.equal(env.state, before);
    assert.equal(env.turns, 0);
    assert.equal(env.step({ type: 'attack' }).accepted, false, 'no attack outside a fight');
});

test('a legal move is applied and passes the turn', () => {
    const env = envFrom({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    const result = env.step({ type: 'move', row: 0, col: 2 });
    assert.equal(result.accepted, true);
    assert.deepEqual(env.state.players[0].position, { row: 0, col: 2 });
    assert.equal(env.currentPlayerIndex, 1);
    assert.equal(env.turns, 1);
});

test('pass gives the turn to the other player', () => {
    const env = envFrom({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    env.step({ type: 'pass' });
    assert.equal(env.currentPlayerIndex, 1);
    assert.deepEqual(env.state.players[0].position, { row: 0, col: 0 });
});

test('a fight action is resolved immediately (no delay)', () => {
    const env = envFrom({ players: [
        { row: 0, col: 0, weapon: createWeapon('Excalibur', 40, 'e.png') },
        { row: 0, col: 1, health: 100 },
    ] });
    setFight(0, 1);
    env.state = store.state;

    const { events } = env.step({ type: 'attack' });
    assert.deepEqual(events.map(e => e.name), ['fight:attack', 'fight:round-end']);
    assert.equal(env.state.players[1].player.health, 60);
    assert.equal(env.currentPlayerIndex, 1, 'roles are swapped');
});

test('a lethal hit ends the game and gives the winner', () => {
    const env = envFrom({ players: [
        { row: 0, col: 0, weapon: createWeapon('Excalibur', 40, 'e.png') },
        { row: 0, col: 1, health: 30 },
    ] });
    setFight(0, 1);
    env.state = store.state;

    const { done } = env.step({ type: 'attack' });
    assert.equal(done, true);
    assert.equal(env.winnerIndex, 0);
});

test('the turn limit ends the game as a draw', () => {
    const env = new GameEnv({ rng: createRng(1), maxTurns: 2 });
    env.reset();
    env.step({ type: 'pass' });
    env.step({ type: 'pass' });
    assert.equal(env.done, true);
    assert.equal(env.winnerIndex, null);
});

// ─── Arène ────────────────────────────────────────────────────────────────────

test('a game between two agents always ends', () => {
    const { winner, turns } = playGame([normalAgent, randomAgent], { rng: createRng(3) });
    assert.ok(winner === 0 || winner === 1 || winner === null);
    assert.ok(turns > 0 && turns <= 300);
});

test('a match is reproducible with the same seed', () => {
    const a = runMatch(normalAgent, randomAgent, { games: 50, seed: 5 });
    const b = runMatch(normalAgent, randomAgent, { games: 50, seed: 5 });
    assert.deepEqual(a, b);
    assert.equal(a.winsA + a.winsB + a.draws, 50);
});

test('the normal agent clearly beats the random agent', () => {
    const r = runMatch(normalAgent, randomAgent, { games: 200, seed: 1 });
    assert.ok(r.winRateA > 0.7, `normal win rate ${r.winRateA}`);
});

test('an agent choosing an illegal action stops the game with an error', () => {
    const cheater = { ...randomAgent, name: 'cheater', chooseMove: () => ({ row: -1, col: -1 }) };
    assert.throws(() => playGame([cheater, randomAgent], { rng: createRng(1) }), /cheater/);
});
