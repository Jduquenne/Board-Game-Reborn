import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { eventBus } from '../src/core/EventBus.js';
import { aiEngine } from '../src/Engine/AIEngine.js';
import { setBoard, setFight, recordEvents, createWeapon, DECOR } from './helpers.mjs';

// Délais de réflexion de AIEngine
const THINK_DELAY       = 900;
const FIGHT_THINK_DELAY = 1500;

let events;

beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] });
    events = recordEvents(['fight:attack', 'fight:defend', 'fight:start']);
    aiEngine.start();
});

afterEach(() => {
    aiEngine.stop();
    events.stop();
    mock.timers.reset();
    mock.restoreAll();
});

const weapon = damage => createWeapon(`Arme ${damage}`, damage, 'arme.png');

// Joueur 0 = humain, joueur 1 = IA ; c'est au tour de l'IA
function aiTurn({ aiMode = 'normal', human = {}, ai = {}, setup } = {}) {
    setBoard({
        rows: 7, cols: 7, aiMode, activePlayerIndex: 1, setup,
        players: [
            { row: 0, col: 0, name: 'Humain', ...human },
            { row: 6, col: 6, name: 'IA', isAI: true, ...ai },
        ],
    });
    eventBus.emit('turn:changed', { activePlayerIndex: 1 });
}

const aiPosition = () => store.state.players[1].position;

// ─── Déplacement ──────────────────────────────────────────────────────────────

test('the AI waits before moving', () => {
    aiTurn();
    mock.timers.tick(THINK_DELAY - 1);
    assert.deepEqual(aiPosition(), { row: 6, col: 6 });
    mock.timers.tick(1);
    assert.notDeepEqual(aiPosition(), { row: 6, col: 6 });
});

test('the AI does not play for a human player', () => {
    setBoard({ aiMode: 'normal', players: [{ row: 0, col: 0 }, { row: 4, col: 4, isAI: true }] });
    eventBus.emit('turn:changed', { activePlayerIndex: 0 });
    mock.timers.tick(THINK_DELAY);
    assert.deepEqual(store.state.players[0].position, { row: 0, col: 0 });
});

test('the AI does nothing in 2-player mode', () => {
    aiTurn({ aiMode: 'none' });
    mock.timers.tick(THINK_DELAY);
    assert.deepEqual(aiPosition(), { row: 6, col: 6 });
});

test('easy: moves to a random reachable cell', () => {
    mock.method(Math, 'random', () => 0);
    aiTurn({ aiMode: 'easy' });
    const firstMovable = store.state.cells.flat().find(c => c.isMovable);
    mock.timers.tick(THINK_DELAY);
    assert.deepEqual(aiPosition(), { row: firstMovable.row, col: firstMovable.col });
});

test('normal: starts a fight when it has the edge', () => {
    aiTurn({
        human: { row: 6, col: 3, weapon: weapon(10) },
        ai:    { weapon: weapon(30) },
    });
    mock.timers.tick(THINK_DELAY);
    assert.deepEqual(aiPosition(), { row: 6, col: 4 });
    assert.equal(store.state.phase, 'fighting');
});

test('normal: avoids the fight without the edge and takes a better weapon', () => {
    aiTurn({
        human: { row: 6, col: 3, weapon: weapon(40), health: 150 },
        ai:    { weapon: weapon(10), health: 100 },
        setup: cells => { cells[4][6].weapon = weapon(35); },
    });
    mock.timers.tick(THINK_DELAY);
    assert.deepEqual(aiPosition(), { row: 4, col: 6 });
    assert.equal(store.state.players[1].player.weapon.damage, 35);
    assert.equal(store.state.phase, 'playing');
});

test('normal: ignores a weaker weapon and takes a bonus', () => {
    aiTurn({
        ai: { weapon: weapon(30) },
        setup: cells => {
            cells[6][4].weapon = weapon(15);
            cells[3][6].bonus  = { name: 'PM +2', type: 'move', amount: 2, image: 'PM.png' };
        },
    });
    mock.timers.tick(THINK_DELAY);
    assert.deepEqual(aiPosition(), { row: 3, col: 6 });
});

test('normal: otherwise moves closer to the enemy', () => {
    aiTurn({
        setup: cells => { cells[5][6].decor = DECOR.OBSTACLE; },
    });
    mock.timers.tick(THINK_DELAY);
    // Seule la ligne 6 est accessible : la case la plus proche de (0,0) est (6,3)
    assert.deepEqual(aiPosition(), { row: 6, col: 3 });
});

// ─── Combat ───────────────────────────────────────────────────────────────────

// Joueur 1 (IA) attaque le joueur 0 (humain)
function aiFight({ aiMode = 'normal', human = {}, ai = {}, event = 'fight:start' } = {}) {
    setBoard({
        aiMode,
        players: [
            { row: 0, col: 0, name: 'Humain', ...human },
            { row: 0, col: 1, name: 'IA', isAI: true, ...ai },
        ],
    });
    setFight(1, 0);
    const attacker = store.state.players[1];
    eventBus.emit(event, event === 'fight:start' ? { attacker } : { nextAttacker: attacker });
}

const fightActions = () => events.names().filter(n => n === 'fight:attack' || n === 'fight:defend');

test('the AI waits before acting in a fight', () => {
    aiFight();
    mock.timers.tick(FIGHT_THINK_DELAY - 1);
    assert.deepEqual(fightActions(), []);
    mock.timers.tick(1);
    assert.equal(fightActions().length, 1);
});

test('the AI also acts at the start of a new round', () => {
    aiFight({ event: 'fight:round-end' });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.equal(fightActions().length, 1);
});

test('the AI does not act for a human attacker', () => {
    setBoard({ aiMode: 'normal', players: [{ row: 0, col: 0 }, { row: 0, col: 1, isAI: true }] });
    setFight(0, 1);
    eventBus.emit('fight:start', { attacker: store.state.players[0] });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), []);
});

test('normal fight: attacks when the hit is lethal', () => {
    aiFight({
        human: { health: 30, weapon: weapon(40) },
        ai:    { health: 20, weapon: weapon(35) },
    });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), ['fight:attack']);
});

test('normal fight: takes the enemy defense into account for a lethal hit', () => {
    aiFight({
        human: { health: 30, defense: true, weapon: weapon(40) },
        ai:    { health: 20, weapon: weapon(35) },
    });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), ['fight:defend'], '35 / 2 = 17 < 30, and the enemy can kill the AI');
});

test('normal fight: defends when the next enemy hit is lethal', () => {
    aiFight({
        human: { health: 100, weapon: weapon(40) },
        ai:    { health: 40, weapon: weapon(20) },
    });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), ['fight:defend']);
});

test('normal fight: attacks when already defending', () => {
    aiFight({
        human: { health: 100, weapon: weapon(40) },
        ai:    { health: 40, defense: true, weapon: weapon(20) },
    });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), ['fight:attack']);
});

test('normal fight: attacks by default', () => {
    aiFight({
        human: { health: 100, weapon: weapon(20) },
        ai:    { health: 100, weapon: weapon(20) },
    });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), ['fight:attack']);
});

test('easy fight: attacks when the random draw is below 70 %', () => {
    mock.method(Math, 'random', () => 0.69);
    aiFight({ aiMode: 'easy' });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), ['fight:attack']);
});

test('easy fight: defends otherwise', () => {
    mock.method(Math, 'random', () => 0.7);
    aiFight({ aiMode: 'easy' });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), ['fight:defend']);
});

test('stop() cancels a pending action', () => {
    aiFight();
    aiEngine.stop();
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), []);
});

// ─── IA Entraînée ─────────────────────────────────────────────────────────────

test('trained mode: the AI fights with the model saved by the training page', () => {
    // Modèle qui préfère toujours se défendre, stocké comme le fait la page d'entraînement
    const model = { actions: ['attack', 'defend'], table: { '10|10|0|0': [0, 1] } };
    globalThis.localStorage = { getItem: key => (key === 'bgr.fightModel' ? JSON.stringify(model) : null), setItem: () => {} };
    aiEngine.stop();
    aiEngine.start(); // recharge le modèle

    try {
        aiFight({ aiMode: 'trained', human: { health: 100, weapon: weapon(10) }, ai: { health: 100, weapon: weapon(10) } });
        mock.timers.tick(FIGHT_THINK_DELAY);
        assert.deepEqual(fightActions(), ['fight:defend']);
    } finally {
        delete globalThis.localStorage;
    }
});

test('trained mode without a saved model: the AI fights like the normal AI', () => {
    aiFight({ aiMode: 'trained', human: { health: 100, weapon: weapon(20) }, ai: { health: 100, weapon: weapon(20) } });
    mock.timers.tick(FIGHT_THINK_DELAY);
    assert.deepEqual(fightActions(), ['fight:attack']);
});

test('trained mode: the AI moves with the evolved movement model', () => {
    // Modèle qui cherche à S'ÉLOIGNER de l'ennemi : l'IA Normal, elle, se rapprocherait (en (3,6))
    const weights = ['duel', 'duelAdvantage', 'weaponGain', 'lifeBonus', 'moveBonus', 'distance', 'exposed', 'exposedDanger', 'betterWeaponDist']
        .map(key => (key === 'distance' ? 1 : 0));
    globalThis.localStorage = { getItem: key => (key === 'bgr.moveModel' ? JSON.stringify({ weights }) : null), setItem: () => {} };
    aiEngine.stop();
    aiEngine.start(); // recharge les modèles

    try {
        aiTurn({ aiMode: 'trained' });
        mock.timers.tick(THINK_DELAY);
        // Cases les plus loin de l'ennemi (0,0) : (5,6) et (6,5), à 11 cases ; (5,6) vient en premier
        assert.deepEqual(aiPosition(), { row: 5, col: 6 });
    } finally {
        delete globalThis.localStorage;
    }
});

test('trained mode: the AI can move with a neural network model', async () => {
    const { NeuralNetwork } = await import('../src/AI/NeuralNetwork.js');
    const { MOVE_INPUT_SIZE } = await import('../src/AI/NeuralMovePolicy.js');
    const { createRng } = await import('../src/core/Random.js');
    const network = new NeuralNetwork({ sizes: [MOVE_INPUT_SIZE, 4, 1], rng: createRng(1) }).toJSON();
    globalThis.localStorage = { getItem: key => (key === 'bgr.moveModel' ? JSON.stringify({ kind: 'network', network }) : null), setItem: () => {} };
    aiEngine.stop();
    aiEngine.start(); // recharge les modèles

    try {
        aiTurn({ aiMode: 'trained' });
        const reachable = store.state.cells.flat().filter(c => c.isMovable).map(c => `${c.row},${c.col}`);
        mock.timers.tick(THINK_DELAY);
        const { row, col } = aiPosition();
        assert.ok(reachable.includes(`${row},${col}`), 'the network moved the AI to a reachable cell');
    } finally {
        delete globalThis.localStorage;
    }
});
