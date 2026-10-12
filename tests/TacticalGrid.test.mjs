import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMap, cellAt, neighbours, distance, reachableCells, cellsInRange, lineOfSight, TERRAIN } from '../src/Engine/Tactical/TacticalGrid.js';
import { TacticalMapsRepository } from '../src/Repository/TacticalMapsRepository.js';

const board = parseMap(TacticalMapsRepository.find('plaine'));
const byScreen = (row, col) => board.cells.find(c => c.row === row && c.col === col);
const count = pred => board.cells.filter(pred).length;

test('the map of assets/image.png has the size of a Dofus Retro map: 15 × 17, 479 cells', () => {
    assert.equal(board.width, 15);
    assert.equal(board.height, 17);
    assert.equal(board.cells.length, 479);
    assert.equal(count(c => c.row === 0), 15);
    assert.equal(count(c => c.row === 1), 14);
});

test('the map has 6 blocks, 8 placement cells per player and a void border', () => {
    assert.equal(count(c => c.terrain === TERRAIN.BLOCK), 6);
    assert.equal(count(c => c.placement === 0), 8);
    assert.equal(count(c => c.placement === 1), 8);
    assert.ok(board.cells.filter(c => c.row === 0 || c.row === 32).every(c => c.terrain === TERRAIN.VOID));
    // 15 + 15 (haut et bas) + 2 × 15 (bords gauche et droit des rangées paires intérieures) + 6 trous
    assert.equal(count(c => c.terrain === TERRAIN.VOID), 30 + 30 + 6);
});

test('ids follow the reading order, like Dofus cell numbers', () => {
    assert.equal(byScreen(0, 0).id, 0);
    assert.equal(byScreen(1, 1).id, 15);
    assert.equal(byScreen(2, 0).id, 29);
    board.cells.forEach((c, i) => assert.equal(c.id, i));
});

test('the 4 neighbours of a cell are its 4 diagonal neighbours on screen', () => {
    const cell = byScreen(10, 10);
    const screen = neighbours(board, cell).map(n => `${n.row}-${n.col}`).sort();
    assert.deepEqual(screen, ['11-11', '11-9', '9-11', '9-9']);
    assert.equal(cellAt(board, cell.x, cell.y), cell);
});

test('distance is the Manhattan distance on the square grid', () => {
    const a = byScreen(10, 10);
    assert.equal(distance(a, byScreen(11, 11)), 1);
    assert.equal(distance(a, byScreen(10, 12)), 2); // une case à droite à l'écran = 2 pas
    assert.equal(distance(a, byScreen(12, 10)), 2); // une rangée pleine plus bas = 2 pas
});

test('reachable cells: at most pm steps, shortest path, voids, blocks and fighters block the way', () => {
    const from = byScreen(10, 10);
    const paths = reachableCells(board, from.id, 3, new Set([from.id]));
    for (const [id, path] of Object.entries(paths)) {
        assert.ok(path.length >= 1 && path.length <= 3);
        assert.equal(path.length, distance(from, board.cells[id])); // terrain dégagé : chemin le plus court
        assert.equal(path.at(-1), Number(id));
    }
    // 4 + 8 + 12 cases à 1, 2 et 3 pas sur un terrain dégagé
    assert.equal(Object.keys(paths).length, 24);

    const blocked = byScreen(11, 11);
    const around = reachableCells(board, from.id, 1, new Set([from.id, blocked.id]));
    assert.equal(around[blocked.id], undefined);

    const hole = byScreen(10, 4);
    assert.equal(hole.terrain, TERRAIN.VOID);
    const nearHole = reachableCells(board, byScreen(10, 6).id, 2, new Set());
    assert.equal(nearHole[hole.id], undefined);
});

test('a detour around an obstacle costs more movement points', () => {
    const block = byScreen(8, 6);
    assert.equal(block.terrain, TERRAIN.BLOCK);
    const from = cellAt(board, block.x - 1, block.y);
    const to = cellAt(board, block.x + 1, block.y);
    assert.equal(reachableCells(board, from.id, 2, new Set())[to.id], undefined);
    assert.equal(reachableCells(board, from.id, 4, new Set())[to.id].length, 4);
});

test('cells in range: floor cells only, between min and max', () => {
    const from = byScreen(10, 10);
    assert.equal(cellsInRange(board, from.id, 1, 1).length, 4);
    assert.ok(cellsInRange(board, from.id, 2, 3).every(id => [2, 3].includes(distance(from, board.cells[id]))));
    const nearHole = cellsInRange(board, byScreen(11, 5).id, 1, 1);
    assert.ok(!nearHole.includes(byScreen(10, 4).id));
});

test('line of sight: a fighter or a block in between blocks it, the end cells do not count', () => {
    const c = (dx, dy) => cellAt(board, 16 + dx, 10 + dy).id;
    assert.ok(lineOfSight(board, c(0, 0), c(4, 0), new Set()));
    assert.ok(!lineOfSight(board, c(0, 0), c(4, 0), new Set([c(2, 0)])));
    assert.ok(lineOfSight(board, c(0, 0), c(4, 0), new Set([c(0, 0), c(4, 0)])));
    assert.ok(!lineOfSight(board, c(0, 2), c(0, 8), new Set())); // bloc en (16, 15)
});

test('line of sight through an exact corner touches neither side cell', () => {
    const c = (dx, dy) => cellAt(board, 16 + dx, 10 + dy).id;
    // de (0, 0) à (2, 2) : la diagonale passe par (1, 1) et par les coins, pas par (1, 0) ni (0, 1)
    assert.ok(lineOfSight(board, c(0, 0), c(2, 2), new Set([c(1, 0), c(0, 1)])));
    assert.ok(!lineOfSight(board, c(0, 0), c(2, 2), new Set([c(1, 1)])));
});

test('cells in line: same x or same y only', () => {
    const from = cellAt(board, 16, 10);
    const line = cellsInRange(board, from.id, 1, 3, true).map(id => board.cells[id]);
    assert.equal(line.length, 12);
    assert.ok(line.every(c => c.x === from.x || c.y === from.y));
});
