import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMovableCells, getAdjacentPositions } from '../src/Engine/MovementSystem.js';
import { makeGrid, makePlayer, DECOR } from './helpers.mjs';

const config = { rows: 5, cols: 5 };
const ids = cells => cells.map(c => c.id).sort();

test('moves in straight lines up to maxMove in the 4 directions', () => {
    const cells = makeGrid(5, 5);
    const result = getMovableCells({ row: 2, col: 2 }, 2, cells, config);
    assert.deepEqual(ids(result), ['0-2', '1-2', '2-0', '2-1', '2-3', '2-4', '3-2', '4-2']);
});

test('stops at the board edge', () => {
    const cells = makeGrid(5, 5);
    const result = getMovableCells({ row: 0, col: 0 }, 3, cells, config);
    assert.deepEqual(ids(result), ['0-1', '0-2', '0-3', '1-0', '2-0', '3-0']);
});

test('an obstacle blocks the rest of the line', () => {
    const cells = makeGrid(5, 5);
    cells[2][3].decor = DECOR.OBSTACLE;
    const result = getMovableCells({ row: 2, col: 2 }, 2, cells, config);
    assert.ok(!result.some(c => c.id === '2-3' || c.id === '2-4'));
    assert.equal(result.length, 6);
});

test('a player blocks the rest of the line', () => {
    const cells = makeGrid(5, 5);
    cells[1][2].player = makePlayer();
    const result = getMovableCells({ row: 2, col: 2 }, 2, cells, config);
    assert.ok(!result.some(c => c.id === '1-2' || c.id === '0-2'));
});

test('items do not block movement', () => {
    const cells = makeGrid(5, 5);
    cells[2][3].weapon = { name: 'w', damage: 20, image: 'w.png' };
    const result = getMovableCells({ row: 2, col: 2 }, 2, cells, config);
    assert.ok(result.some(c => c.id === '2-4'));
});

test('getAdjacentPositions returns only positions inside the board', () => {
    assert.equal(getAdjacentPositions({ row: 2, col: 2 }, config).length, 4);
    assert.equal(getAdjacentPositions({ row: 0, col: 0 }, config).length, 2);
    assert.equal(getAdjacentPositions({ row: 4, col: 2 }, config).length, 3);
});
