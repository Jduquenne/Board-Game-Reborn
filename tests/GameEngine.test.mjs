import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { gameEngine } from '../src/Engine/GameEngine.js';
import { skipIfBlocked } from '../src/Engine/Rules.js';
import { setBoard, recordEvents, createWeapon, DECOR } from './helpers.mjs';

let events;
afterEach(() => events?.stop());

const config = { rows: 10, cols: 10, nbObstacles: 10, nbWeapons: 3, nbBonus: 2, nbTraps: 4, aiMode: 'none' };

// ─── startGame ────────────────────────────────────────────────────────────────

test('startGame builds the board from the config', () => {
    events = recordEvents(['game:started', 'game:initiative', 'turn:changed']);
    gameEngine.startGame(config);
    const { phase, cells, players, activePlayerIndex, fight } = store.state;
    const flat = cells.flat();

    assert.equal(phase, 'playing');
    assert.equal(cells.length, 10);
    assert.equal(cells[0].length, 10);
    assert.equal(flat.filter(c => c.decor === DECOR.OBSTACLE).length, 10);
    assert.equal(flat.filter(c => c.weapon).length, 3);
    assert.equal(flat.filter(c => c.bonus).length, 2);
    assert.equal(flat.filter(c => c.trap).length, 4);
    assert.equal(players.length, 2);
    assert.notEqual(players[0].player.name, players[1].player.name);
    // Le personnage qui a la plus haute initiative commence (égalité : l'un ou l'autre)
    const [a, b] = players.map(p => p.player.initiative);
    if (a !== b) assert.equal(activePlayerIndex, a > b ? 0 : 1);
    assert.equal(fight, null);
    assert.ok(flat.some(c => c.isMovable), 'movable cells are computed for the first player');
    assert.deepEqual(events.names(), ['game:started', 'game:initiative', 'turn:changed']);
});

test('player 1 is the AI only when an AI mode is selected', () => {
    gameEngine.startGame({ ...config, aiMode: 'none' });
    assert.deepEqual(store.state.players.map(p => p.player.isAI), [false, false]);

    gameEngine.startGame({ ...config, aiMode: 'normal' });
    assert.deepEqual(store.state.players.map(p => p.player.isAI), [false, true]);
});

test('starting a new game keeps the config and resets players', () => {
    gameEngine.startGame({ ...config, rows: 8, cols: 12 });
    gameEngine.startGame(store.state.config);
    const { config: kept, players } = store.state;
    assert.equal(kept.rows, 8);
    assert.equal(kept.cols, 12);
    assert.ok(players.every(p => p.player.health === p.player.maxHealth));
});

// ─── movePlayer ───────────────────────────────────────────────────────────────

test('a move to a non-movable cell is ignored', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    const before = store.state;
    gameEngine.movePlayer(3, 3);
    assert.equal(store.state, before);
});

test('a move is ignored outside the playing phase', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    store.setState(() => ({ phase: 'gameover' }));
    gameEngine.movePlayer(0, 2);
    assert.deepEqual(store.state.players[0].position, { row: 0, col: 0 });
});

test('a move updates the position and passes the turn', () => {
    setBoard({ players: [{ row: 0, col: 0, maxMove: 3 }, { row: 4, col: 4 }] });
    events = recordEvents(['turn:changed']);

    gameEngine.movePlayer(0, 2);

    const { cells, players, activePlayerIndex } = store.state;
    assert.deepEqual(players[0].position, { row: 0, col: 2 });
    assert.equal(cells[0][0].player, null);
    assert.equal(cells[0][2].player.name, players[0].player.name);
    assert.equal(activePlayerIndex, 1);
    assert.deepEqual(events.log[0].payload, { activePlayerIndex: 1 });
    assert.ok(cells[3][4].isMovable, 'movable cells are recomputed for player 1');
});

test('picking up a weapon swaps it with the current one', () => {
    const excalibur = createWeapon('Excalibur', 40, 'Excalibur.png');
    setBoard({
        players: [{ row: 0, col: 0 }, { row: 4, col: 4 }],
        setup: cells => { cells[0][1].weapon = excalibur; },
    });
    const oldWeapon = store.state.players[0].player.weapon;

    gameEngine.movePlayer(0, 1);

    const { cells, players } = store.state;
    assert.equal(players[0].player.weapon.name, 'Excalibur');
    assert.equal(cells[0][1].weapon.name, oldWeapon.name);
});

test('a life bonus adds health and disappears', () => {
    setBoard({
        players: [{ row: 0, col: 0, health: 60 }, { row: 4, col: 4 }],
        setup: cells => { cells[0][1].bonus = { name: 'Vie +30', type: 'life', amount: 30, image: 'life.png' }; },
    });
    gameEngine.movePlayer(0, 1);
    assert.equal(store.state.players[0].player.health, 90);
    assert.equal(store.state.cells[0][1].bonus, null);
});

test('a move bonus adds movement points', () => {
    setBoard({
        players: [{ row: 0, col: 0, maxMove: 3 }, { row: 4, col: 4 }],
        setup: cells => { cells[0][1].bonus = { name: 'PM +2', type: 'move', amount: 2, image: 'PM.png' }; },
    });
    gameEngine.movePlayer(0, 1);
    assert.equal(store.state.players[0].player.maxMove, 5);
});

test('a trap removes 20 health once and is revealed', () => {
    setBoard({
        players: [{ row: 0, col: 0, health: 100 }, { row: 4, col: 4 }],
        setup: cells => {
            cells[0][1].trap = { name: 'trap1', image: 'trap1.png', triggered: false };
            cells[0][2].trap = { name: 'trap2', image: 'trap1.png', triggered: true };
        },
    });
    events = recordEvents(['trap:triggered']);

    gameEngine.movePlayer(0, 1);

    assert.equal(store.state.players[0].player.health, 80);
    assert.equal(store.state.cells[0][1].trap.triggered, true);
    assert.equal(events.log.length, 1);
    assert.equal(events.log[0].payload.playerInfo.player.health, 80);
});

test('an already triggered trap does nothing', () => {
    setBoard({
        players: [{ row: 0, col: 0, health: 100 }, { row: 4, col: 4 }],
        setup: cells => { cells[0][1].trap = { name: 'trap1', image: 'trap1.png', triggered: true }; },
    });
    gameEngine.movePlayer(0, 1);
    assert.equal(store.state.players[0].player.health, 100);
});

test('trap damage never brings health below 0', () => {
    setBoard({
        players: [{ row: 0, col: 0, health: 10 }, { row: 4, col: 4 }],
        setup: cells => { cells[0][1].trap = { name: 'trap1', image: 'trap1.png', triggered: false }; },
    });
    gameEngine.movePlayer(0, 1);
    assert.equal(store.state.players[0].player.health, 0);
});

test('moving next to the waiting player starts a fight instead of passing the turn', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 0, col: 3 }] });
    assert.ok(store.state.cells[0][2].isSecurityZone);
    events = recordEvents(['fight:start', 'turn:changed']);

    gameEngine.movePlayer(0, 2);

    const { phase, fight, activePlayerIndex } = store.state;
    assert.equal(phase, 'fighting');
    assert.deepEqual(fight, { attackerIndex: 0, targetIndex: 1 });
    assert.equal(activePlayerIndex, 0);
    assert.deepEqual(events.names(), ['fight:start']);
});

// ─── Joueur bloqué ────────────────────────────────────────────────────────────

test('a blocked player automatically skips their turn', () => {
    // Joueur 1 dans un coin, enfermé par deux obstacles
    setBoard({
        players: [{ row: 4, col: 4 }, { row: 0, col: 0 }],
        setup: cells => { cells[0][1].decor = DECOR.OBSTACLE; cells[1][0].decor = DECOR.OBSTACLE; },
    });
    events = recordEvents(['turn:skipped', 'turn:changed']);

    gameEngine.movePlayer(4, 3);

    assert.equal(store.state.activePlayerIndex, 0, 'the turn comes back to player 0');
    assert.deepEqual(events.names(), ['turn:skipped', 'turn:changed']);
    assert.equal(events.log[0].payload.playerInfo, store.state.players[1]);
    assert.deepEqual(events.log[1].payload, { activePlayerIndex: 0 });
    assert.ok(store.state.cells.flat().some(c => c.isMovable), 'player 0 can move again');
});

test('a first player blocked at the start skips their turn', () => {
    setBoard({
        players: [{ row: 0, col: 0 }, { row: 4, col: 4 }],
        setup: cells => { cells[0][1].decor = DECOR.OBSTACLE; cells[1][0].decor = DECOR.OBSTACLE; },
    });
    const { state, events: emitted } = skipIfBlocked(store.state);

    assert.equal(state.activePlayerIndex, 1);
    assert.deepEqual(emitted.map(e => e.name), ['turn:skipped', 'turn:changed']);
    assert.equal(emitted[0].payload.playerInfo, store.state.players[0]);
    assert.equal(skipIfBlocked(state).state, state, 'nothing to skip when the player can move');
});
