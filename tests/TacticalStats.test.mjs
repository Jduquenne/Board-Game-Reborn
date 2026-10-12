import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyCast, applyMove, applyEndTurn, criticalRate, dodgeChance, statMultiplier, suddenDeathDamage,
    PUSH_DAMAGE, SUDDEN_DEATH_TURN, BASE_PM,
} from '../src/Engine/Tactical/TacticalRules.js';
import { duel, at, withFighter, NO_CRIT_MIN } from './tacticalHelpers.mjs';

const hp = (state, i) => state.fighters[i].health;
const cell = (state, i) => state.fighters[i].cellId;
const spellOf = (state, i, id) => state.fighters[i].spells.find(s => s.id === id);

test('each element uses its stat: +1 % damage per point', () => {
    const state = duel(['cra', 'iop'], [0, 0], [4, 4]);
    const cra = state.fighters[0];
    assert.equal(statMultiplier(cra, 'agility'), 1.4);
    assert.equal(statMultiplier(cra, 'strength'), 1);
});

test('Agility lowers the critical rate (1 in N × 50 / (50 + Agility), at least 2)', () => {
    const state = duel(['cra', 'iop'], [0, 0], [4, 4]);
    const [cra, iop] = state.fighters;
    assert.equal(criticalRate(spellOf(state, 0, 'fleche-magique'), cra), 22);  // 40 × 50 / 90
    assert.equal(criticalRate(spellOf(state, 1, 'pression'), iop), 33);        // 40 × 50 / 60
    assert.equal(criticalRate(spellOf(state, 1, 'bond'), iop), 0);             // pas de critique
    assert.equal(criticalRate({ critRate: 2 }, { stats: { agility: 500 } }), 2);
});

test('dodge chance = (Agility + 25) / (Agility + enemy Agility + 50)', () => {
    const state = duel(['cra', 'iop'], [0, 0], [4, 4]);
    const [cra, iop] = state.fighters;
    assert.equal(dodgeChance(cra, iop), 65 / 100);
    assert.equal(dodgeChance(iop, cra), 35 / 100);
});

test('the state tells which moves leave the enemy\'s contact', () => {
    const state = duel(['cra', 'iop'], [0, 0], [1, 0]);
    assert.equal(state.tackle.chance, 0.65);
    assert.equal(state.tackle.rolls[at(state, -1, 0)], 1);
    assert.equal(state.tackle.rolls[at(state, -2, 0)], 1);
    const far = duel(['cra', 'iop'], [0, 0], [4, 4]);
    assert.deepEqual(far.tackle.rolls, {});
});

test('leaving contact: a successful dodge lets the move go on', () => {
    const state = duel(['cra', 'iop'], [0, 0], [1, 0]);
    const result = applyMove(state, at(state, -2, 0), () => 0.5);   // 0,5 < 0,65 : esquive
    assert.deepEqual(result.events.map(e => e.name), ['tactical:moved', 'tactical:dodged']);
    assert.equal(cell(result.state, 0), at(state, -2, 0));
    assert.equal(result.state.fighters[0].pm, BASE_PM - 2);
});

test('leaving contact: a failed dodge stops the fighter and removes all its PM', () => {
    const state = duel(['iop', 'cra'], [0, 0], [1, 0]);
    const result = applyMove(state, at(state, -2, 0), () => 0.5);   // 0,5 ≥ 0,35 : taclé
    assert.deepEqual(result.events.map(e => e.name), ['tactical:tackled']);
    assert.equal(cell(result.state, 0), cell(state, 0));
    assert.equal(result.state.fighters[0].pm, 0);
    assert.deepEqual(result.state.reachable, {});
    assert.ok(result.state.spells.pression.available); // il peut encore lancer ses sorts
});

test('moves away from the enemy need no dodge roll', () => {
    const state = duel(['iop', 'cra'], [0, 0], [4, 4]);
    const result = applyMove(state, at(state, -2, 0), () => { throw new Error('no roll expected'); });
    assert.deepEqual(result.events.map(e => e.name), ['tactical:moved']);
});

test('a push blocked by an obstacle deals damage for each cell not travelled', () => {
    // Bloc en (16, 15) : l'ennemi en (16, 14) ne peut pas reculer
    let state = duel(['iop', 'cra'], [0, 3], [0, 4]);
    const result = applyCast(state, 'intimidation', at(state, 0, 4), NO_CRIT_MIN());
    const push = result.events[0].payload.results.find(r => r.kind === 'push');
    assert.deepEqual([push.amount, push.damage], [0, 3 * PUSH_DAMAGE]);
    // Intimidation : 4 dégâts neutres × (1 + Force 40 %) = 5,6 → 6, plus la poussée
    assert.equal(hp(result.state, 1), 135 - 6 - 3 * PUSH_DAMAGE);

    state = duel(['iop', 'cra'], [0, 0], [1, 0]);
    const free = applyCast(state, 'intimidation', at(state, 1, 0), NO_CRIT_MIN());
    assert.equal(free.events[0].payload.results.find(r => r.kind === 'push').damage, 0);
});

test('sudden death: from turn 30, the player starting a turn loses 10 HP, +5 every 10 turns', () => {
    assert.equal(suddenDeathDamage(SUDDEN_DEATH_TURN - 1), 0);
    assert.equal(suddenDeathDamage(SUDDEN_DEATH_TURN), 10);
    assert.equal(suddenDeathDamage(SUDDEN_DEATH_TURN + 10), 15);

    const state = { ...duel(['iop', 'cra'], [0, 0], [4, 4]), turn: SUDDEN_DEATH_TURN - 1 };
    const result = applyEndTurn(state);
    assert.deepEqual(result.events.map(e => e.name), ['tactical:sudden-death', 'tactical:turn']);
    assert.equal(hp(result.state, 1), 135 - 10);
});

test('sudden death can end the fight', () => {
    const state = withFighter({ ...duel(['iop', 'cra'], [0, 0], [4, 4]), turn: SUDDEN_DEATH_TURN - 1 }, 1, { health: 5 });
    const result = applyEndTurn(state);
    assert.deepEqual(result.events.map(e => e.name), ['tactical:sudden-death', 'tactical:over']);
    assert.equal(result.state.phase, 'over');
    assert.equal(result.state.winnerIndex, 0);
});
