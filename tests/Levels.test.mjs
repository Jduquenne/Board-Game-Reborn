import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { createRng } from '../src/core/Random.js';
import { GameEnv } from '../src/AI/GameEnv.js';
import { playGame } from '../src/AI/Arena.js';
import { normalAgent } from '../src/AI/ScriptedAgents.js';
import { AI_LEVELS } from '../src/AI/Levels.js';
import { EXPERT_MOVE_FEATURES, expertMoveFeatures, expectedDamage, effectiveHealth, createExpertMoveAgent } from '../src/AI/ExpertMoveFeatures.js';
import { EXPERT_MOVE_WEIGHTS } from '../src/AI/DefaultModels.js';
import { createSearchAgent, hideTraps } from '../src/AI/SearchAgent.js';
import { setBoard, setFight, createWeapon } from './helpers.mjs';

// ─── Niveaux Difficile, Expert, Godlike ──────────────────────────────────────

test('expected damage counts the target dodge and the attacker criticals', () => {
    const weapon = createWeapon('w', 20, 'w.png');
    assert.equal(expectedDamage({ weapon }, {}), 20);
    assert.equal(expectedDamage({ weapon }, { luck: 10 }), 20 * 0.7, '30 % dodge');
    assert.ok(Math.abs(expectedDamage({ weapon, agility: 10 }, {}) - 20 * 1.3) < 1e-9, '30 % critical, × 2');
});

test('effective health adds half of the heals the mana still allows', () => {
    assert.equal(effectiveHealth({ health: 50 }), 50);
    assert.equal(effectiveHealth({ health: 50, intelligence: 6, mana: 45 }), 50 + 2 * 28 / 2);
});

test('the Expert weights match its features, and every level plays complete legal games', () => {
    assert.equal(EXPERT_MOVE_WEIGHTS.length, EXPERT_MOVE_FEATURES.length);
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    const cell = store.state.cells.flat().find(c => c.isMovable);
    assert.equal(expertMoveFeatures(store.state, cell).length, EXPERT_MOVE_FEATURES.length);

    const rng = createRng(5);
    for (const agent of [AI_LEVELS.hard, AI_LEVELS.expert, createSearchAgent(AI_LEVELS.expert, { rollouts: 3, candidates: 2 })]) {
        const { winner } = playGame([agent, normalAgent], { rng });
        assert.notEqual(winner, null, agent.name);
    }
});

test('the Expert ranks the cells from best to worst; its first choice is its move', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    const expert = createExpertMoveAgent(EXPERT_MOVE_WEIGHTS);
    const ranked = expert.rankMoves(store.state);
    assert.equal(ranked.length, store.state.cells.flat().filter(c => c.isMovable).length);
    assert.equal(expert.chooseMove(store.state), ranked[0]);
});

test('the search does not know where hidden traps are: they move, triggered ones stay', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }], setup: cells => {
        cells[2][2].trap = { name: 'hidden', triggered: false };
        cells[3][3].trap = { name: 'seen', triggered: true };
    } });
    const state = store.state;
    const moved = new Set();
    for (let seed = 1; seed <= 20; seed++) {
        const copy  = hideTraps(state, createRng(seed));
        const traps = copy.cells.flat().filter(c => c.trap);
        assert.equal(traps.length, 2);
        assert.equal(copy.cells[3][3].trap.name, 'seen');
        const hidden = traps.find(c => c.trap.name === 'hidden');
        assert.ok(!hidden.player && !hidden.weapon && !hidden.bonus);
        moved.add(hidden.id);
    }
    assert.ok(moved.size > 5, 'the hidden trap is placed at random');
    assert.equal(state.cells[2][2].trap.name, 'hidden', 'the real state is never modified');
});

test('a game can resume from a given state', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4 }] });
    const env = new GameEnv();
    assert.equal(env.reset(store.state), store.state);
    assert.equal(env.turns, 0);
});

test('Godlike finds the winning fight action by thinking ahead', () => {
    // Mon coup tue l'adversaire (pas d'esquive possible) : la recherche doit attaquer,
    // même si sa stratégie de base se défend toujours.
    setBoard({ players: [
        { row: 2, col: 2, health: 100, weapon: createWeapon('w10', 10, 'w.png') },
        { row: 2, col: 3, health: 5, weapon: createWeapon('w10', 10, 'w.png') },
    ] });
    setFight(0, 1);
    const alwaysDefend = { ...AI_LEVELS.expert, chooseFightAction: () => 'defend' };
    const godlike = createSearchAgent(alwaysDefend, { rollouts: 10 });
    assert.equal(alwaysDefend.chooseFightAction(), 'defend');
    assert.equal(godlike.chooseFightAction(store.state, createRng(1)), 'attack');
});
