import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTacticalGame, applyPlace, applyStart, applyMove, applyCast, applyEndTurn, BASE_PA, BASE_PM } from '../src/Engine/Tactical/TacticalRules.js';
import { cellAt, distance } from '../src/Engine/Tactical/TacticalGrid.js';
import { createRng } from '../src/core/Random.js';
import { duel, at } from './tacticalHelpers.mjs';

const eventNames = result => result.events.map(e => e.name);

test('a new game starts with the placement phase, each class on a placement cell of its colour', () => {
    const state = createTacticalGame({ classes: ['iop', 'cra'] }, createRng(1));
    const [a, b] = state.fighters;
    assert.equal(state.phase, 'placement');
    assert.deepEqual([a.name, b.name], ['Iop', 'Crâ']);
    assert.deepEqual([a.health, b.health], [110, 90]);
    assert.equal(state.board.cells[a.cellId].placement, 0);
    assert.equal(state.board.cells[b.cellId].placement, 1);
    assert.deepEqual(state.reachable, {});
    assert.deepEqual(state.spells, {});
});

test('two fighters of the same class get their colour in their name', () => {
    const state = createTacticalGame({ classes: ['iop', 'iop'] }, createRng(1));
    assert.deepEqual(state.fighters.map(f => f.name), ['Iop bleu', 'Iop rouge']);
});

test('placement: a click on a free cell of a colour moves the fighter of that colour', () => {
    const state = createTacticalGame({ classes: ['iop', 'cra'] }, createRng(1));
    const free = state.board.cells.find(c => c.placement === 1 && c.id !== state.fighters[1].cellId);
    const result = applyPlace(state, free.id);
    assert.deepEqual(eventNames(result), ['tactical:placed']);
    assert.equal(result.state.fighters[1].cellId, free.id);
    assert.equal(result.state.fighters[0].cellId, state.fighters[0].cellId);

    const plain = state.board.cells.find(c => c.placement === null && c.terrain === 'floor');
    assert.equal(applyPlace(state, plain.id).state, state);
    assert.equal(applyPlace(state, state.fighters[0].cellId).state, state);
});

test('start: the higher initiative plays first (Crâ 110 before Iop 100), with full PA and PM', () => {
    const state = createTacticalGame({ classes: ['iop', 'cra'] }, createRng(1));
    const result = applyStart(state, () => 0);
    assert.deepEqual(eventNames(result), ['tactical:initiative', 'tactical:turn']);
    assert.equal(result.state.phase, 'fighting');
    assert.equal(result.state.activeIndex, 1);
    assert.equal(result.state.fighters[1].pa, BASE_PA);
    assert.equal(result.state.fighters[1].pm, BASE_PM);
    assert.equal(applyPlace(result.state, state.fighters[0].cellId).state, result.state); // plus de placement
});

test('start: on equal initiative, a coin flip decides', () => {
    const state = createTacticalGame({ classes: ['iop', 'iop'] }, createRng(1));
    assert.equal(applyStart(state, () => 0).state.activeIndex, 0);
    assert.equal(applyStart(state, () => 0.99).state.activeIndex, 1);
});

test('moving costs one PM per cell of the path; several moves per turn while PM remain', () => {
    let state = duel(['iop', 'cra'], [0, 0], [4, 4]);
    const from = state.board.cells[state.fighters[0].cellId];
    state = applyMove(state, at(state, 2, 0)).state;
    assert.equal(state.fighters[0].pm, 1);
    assert.equal(distance(from, state.board.cells[state.fighters[0].cellId]), 2);
    assert.ok(Object.values(state.reachable).every(p => p.length === 1));
    state = applyMove(state, at(state, 2, 1)).state;
    assert.equal(state.fighters[0].pm, 0);
    assert.deepEqual(state.reachable, {});
    assert.equal(applyMove(state, at(state, 2, 2)).state, state);
});

test('ending the turn hands over to the other player with full PA and PM', () => {
    let state = duel(['iop', 'cra'], [0, 0], [1, 0]);
    state = applyCast(state, 'pression', at(state, 1, 0), () => 0).state;
    const result = applyEndTurn(state);
    assert.deepEqual(eventNames(result), ['tactical:turn']);
    state = result.state;
    assert.equal(state.activeIndex, 1);
    assert.equal(state.fighters[1].pa, BASE_PA);
    assert.equal(state.fighters[0].pa, BASE_PA - 3); // rechargé au début de son prochain tour seulement
});

test('a spell is refused out of range, without PA, or over its casts per turn', () => {
    let state = duel(['iop', 'cra'], [0, 0], [2, 0]);
    assert.equal(applyCast(state, 'pression', at(state, 2, 0), () => 0).state, state); // portée 1
    state = duel(['iop', 'cra'], [0, 0], [1, 0]);
    state = applyCast(state, 'intimidation', at(state, 1, 0), () => 0).state; // 1 par tour
    const enemy = state.board.cells[state.fighters[1].cellId];
    assert.equal(state.spells.intimidation.available, false);
    assert.equal(applyCast(state, 'intimidation', enemy.id, () => 0).state, state);
});

test('a fighter brought to 0 HP loses; nothing can be played afterwards', () => {
    let state = duel(['iop', 'cra'], [0, 0], [1, 0]);
    state = { ...state, fighters: state.fighters.map((f, i) => i === 1 ? { ...f, health: 5 } : f) };
    const result = applyCast(state, 'pression', at(state, 1, 0), () => 0);
    assert.deepEqual(eventNames(result), ['tactical:spell', 'tactical:over']);
    assert.deepEqual(result.events[1].payload, { winnerIndex: 0, loserIndex: 1 });
    state = result.state;
    assert.equal(state.phase, 'over');
    assert.equal(state.fighters[1].health, 0);
    assert.equal(applyEndTurn(state).state, state);
    assert.deepEqual(state.spells, {});
});

test('same seed → same game', () => {
    const a = createTacticalGame({ classes: ['cra', 'sacrieur'] }, createRng(7));
    const b = createTacticalGame({ classes: ['cra', 'sacrieur'] }, createRng(7));
    assert.deepEqual(a.fighters.map(f => f.cellId), b.fighters.map(f => f.cellId));
    assert.equal(cellAt(a.board, 16, 10).id, cellAt(b.board, 16, 10).id);
});
