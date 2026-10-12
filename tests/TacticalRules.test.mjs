import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTacticalGame, applyMove, applyPunch, applyEndTurn, BASE_PA, BASE_PM, PUNCH } from '../src/Engine/Tactical/TacticalRules.js';
import { cellAt, distance } from '../src/Engine/Tactical/TacticalGrid.js';
import { createRng } from '../src/core/Random.js';

const newGame = (seed = 1) => createTacticalGame({}, createRng(seed));
const eventNames = result => result.events.map(e => e.name);

// Place les deux personnages côte à côte au milieu du plateau (cases (x, y) et (x + 1, y))
function adjacent(state) {
    const a = state.board.cells.find(c => c.row === 12 && c.col === 14);
    const b = cellAt(state.board, a.x + 1, a.y);
    const fighters = state.fighters.map((f, i) => ({ ...f, cellId: i === 0 ? a.id : b.id }));
    // Recalcule les options du joueur actif en repassant par une fin de tour de chaque joueur
    return applyEndTurn(applyEndTurn({ ...state, fighters }).state).state;
}

test('a new game: two different characters on their own placement cells, 6 PA and 3 PM, player 1 starts', () => {
    const state = newGame();
    const [a, b] = state.fighters;
    assert.notEqual(a.name, b.name);
    assert.equal(state.board.cells[a.cellId].placement, 0);
    assert.equal(state.board.cells[b.cellId].placement, 1);
    assert.deepEqual([a.pa, a.pm, b.pa, b.pm], [BASE_PA, BASE_PM, BASE_PA, BASE_PM]);
    assert.equal(state.activeIndex, 0);
    assert.equal(state.phase, 'fighting');
});

test('same seed → same game', () => {
    assert.deepEqual(newGame(7).fighters, newGame(7).fighters);
});

test('moving costs one PM per cell of the path; several moves per turn while PM remain', () => {
    let state = newGame();
    const from = state.board.cells[state.fighters[0].cellId];
    const [twoSteps] = Object.entries(state.reachable).filter(([, p]) => p.length === 2);
    let result = applyMove(state, Number(twoSteps[0]));
    assert.deepEqual(eventNames(result), ['tactical:moved']);
    state = result.state;
    assert.equal(state.fighters[0].pm, 1);
    assert.equal(distance(from, state.board.cells[state.fighters[0].cellId]), 2);

    // Il reste 1 PM : seules les cases à 1 pas sont atteignables
    assert.ok(Object.values(state.reachable).every(p => p.length === 1));
    const [oneStep] = Object.keys(state.reachable);
    state = applyMove(state, Number(oneStep)).state;
    assert.equal(state.fighters[0].pm, 0);
    assert.deepEqual(state.reachable, {});
});

test('a move out of reach is refused', () => {
    const state = newGame();
    const far = state.board.cells.find(c => c.placement === 1);
    const result = applyMove(state, far.id);
    assert.equal(result.state, state);
    assert.deepEqual(result.events, []);
});

test('the punch hits an adjacent enemy for 8 to 12 damage and costs 3 PA', () => {
    let state = adjacent(newGame());
    const enemyCell = state.fighters[1].cellId;
    const result = applyPunch(state, enemyCell, () => 0.999);
    assert.deepEqual(eventNames(result), ['tactical:attack']);
    assert.equal(result.events[0].payload.damage, PUNCH.maxDamage);
    state = result.state;
    assert.equal(state.fighters[1].health, state.fighters[1].maxHealth - PUNCH.maxDamage);
    assert.equal(state.fighters[0].pa, BASE_PA - PUNCH.cost);
    assert.equal(applyPunch(newGame(), enemyCell, () => 0).events.length, 0); // pas à portée au départ
    assert.equal(applyPunch(adjacent(newGame()), enemyCell, () => 0).events[0].payload.damage, PUNCH.minDamage);
});

test('two punches per turn with 6 PA, the third one is refused', () => {
    let state = adjacent(newGame());
    const enemyCell = state.fighters[1].cellId;
    state = applyPunch(state, enemyCell, () => 0).state;
    state = applyPunch(state, enemyCell, () => 0).state;
    assert.equal(state.fighters[0].pa, 0);
    assert.deepEqual(state.targets, []);
    const third = applyPunch(state, enemyCell, () => 0);
    assert.equal(third.state, state);
});

test('a punch on an empty cell is refused', () => {
    const state = adjacent(newGame());
    const empty = state.targets.find(id => id !== state.fighters[1].cellId);
    assert.equal(applyPunch(state, empty, () => 0).state, state);
});

test('ending the turn hands over to the other player with full PA and PM', () => {
    let state = adjacent(newGame());
    state = applyPunch(state, state.fighters[1].cellId, () => 0).state;
    const result = applyEndTurn(state);
    assert.deepEqual(eventNames(result), ['tactical:turn']);
    state = result.state;
    assert.equal(state.activeIndex, 1);
    assert.equal(state.fighters[1].pa, BASE_PA);
    assert.equal(state.fighters[1].pm, BASE_PM);
    assert.equal(state.fighters[0].pa, BASE_PA - PUNCH.cost); // rechargé au début de son prochain tour seulement
    assert.ok(state.targets.includes(state.fighters[0].cellId));
});

test('a punch that brings the enemy to 0 HP ends the fight; no action afterwards', () => {
    let state = adjacent(newGame());
    state = { ...state, fighters: state.fighters.map((f, i) => i === 1 ? { ...f, health: 5 } : f) };
    const result = applyPunch(state, state.fighters[1].cellId, () => 0);
    assert.deepEqual(eventNames(result), ['tactical:attack', 'tactical:over']);
    assert.deepEqual(result.events[1].payload, { winnerIndex: 0, loserIndex: 1 });
    state = result.state;
    assert.equal(state.phase, 'over');
    assert.equal(state.fighters[1].health, 0);
    assert.equal(applyEndTurn(state).state, state);
    assert.deepEqual(state.reachable, {});
});
