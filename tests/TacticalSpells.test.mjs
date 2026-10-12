import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCast, applyEndTurn, applyMove, BASE_PA } from '../src/Engine/Tactical/TacticalRules.js';
import { TacticalClassesRepository } from '../src/Repository/TacticalClassesRepository.js';
import { duel, at, withFighter } from './tacticalHelpers.mjs';

const MIN = () => 0;     // jet minimum
const MAX = () => 0.999; // jet maximum
const hp = (state, i) => state.fighters[i].health;
const cell = (state, i) => state.fighters[i].cellId;
const cast = (state, spell, dx, dy, rng = MIN) => applyCast(state, spell, at(state, dx, dy), rng);

test('every class has 4 spells + Coup de poing, all castable with 6 PA', () => {
    for (const c of TacticalClassesRepository.findAll()) {
        assert.equal(c.spells.length, 5, c.name);
        assert.ok(c.spells.some(s => s.id === 'punch'));
        assert.ok(c.spells.every(s => s.cost <= BASE_PA), c.name);
    }
});

test('Pression: 13 to 17 damage on an adjacent enemy, 3 PA, twice per turn', () => {
    let state = duel(['iop', 'cra'], [0, 0], [1, 0]);
    const result = cast(state, 'pression', 1, 0, MAX);
    assert.equal(result.events[0].payload.results[0].amount, 17);
    state = result.state;
    assert.equal(hp(state, 1), 90 - 17);
    assert.equal(state.fighters[0].pa, 3);
    state = cast(state, 'pression', 1, 0).state;
    assert.equal(hp(state, 1), 90 - 17 - 13);
    assert.equal(state.fighters[0].pa, 0);
});

test('line of sight: a block stops Flèche magique, a hole does not', () => {
    // Bloc en (16, 15) : 5 pas sous la case de référence
    let state = duel(['cra', 'iop'], [0, 2], [0, 8]);
    assert.ok(state.spells['fleche-magique'].blocked.includes(cell(state, 1)));
    assert.equal(cast(state, 'fleche-magique', 0, 8).state, state);

    // Trou en (14, 15) : entre (10, 15) et (15, 15)
    state = duel(['cra', 'iop'], [-6, 5], [-1, 5]);
    assert.ok(state.spells['fleche-magique'].valid.includes(cell(state, 1)));
});

test('Flèche magique has a minimum range of 2; Flèche de recul only in line', () => {
    let state = duel(['cra', 'iop'], [0, 0], [1, 0]);
    assert.ok(!state.spells['fleche-magique'].range.includes(cell(state, 1)));
    state = duel(['cra', 'iop'], [0, 0], [2, 1]);
    assert.ok(state.spells['fleche-magique'].valid.includes(cell(state, 1)));
    assert.ok(!state.spells['fleche-recul'].range.includes(cell(state, 1)));
    state = duel(['cra', 'iop'], [0, 0], [0, 3]);
    assert.ok(state.spells['fleche-recul'].valid.includes(cell(state, 1)));
});

test('Intimidation pushes the enemy 3 cells away from the caster', () => {
    let state = duel(['iop', 'cra'], [0, 0], [1, 0]);
    const result = cast(state, 'intimidation', 1, 0);
    state = result.state;
    assert.equal(cell(state, 1), at(state, 4, 0));
    assert.deepEqual(result.events[0].payload.results.map(r => r.kind), ['damage', 'push']);
});

test('a push stops at a block or a fighter', () => {
    // Bloc en (16, 15)
    let state = duel(['iop', 'cra'], [0, 3], [0, 4]);
    state = cast(state, 'intimidation', 0, 4).state;
    assert.equal(cell(state, 1), at(state, 0, 4));
});

test('Attirance pulls the enemy next to the caster', () => {
    let state = duel(['sacrieur', 'cra'], [0, 0], [-4, 0]);
    state = cast(state, 'attirance', -4, 0).state;
    assert.equal(cell(state, 1), at(state, -1, 0));
    assert.equal(hp(state, 1), 90);
});

test('Bond teleports to a free cell, not onto a fighter; relaunch after 2 turns of the caster', () => {
    let state = duel(['iop', 'cra'], [0, 0], [3, 0]);
    assert.ok(!state.spells.bond.valid.includes(cell(state, 1)));
    state = cast(state, 'bond', 2, 0).state;
    assert.equal(cell(state, 0), at(state, 2, 0));
    state = applyEndTurn(applyEndTurn(state).state).state;   // tour suivant de l'Iop
    assert.equal(state.spells.bond.available, false);
    assert.equal(state.spells.bond.cooldown, 1);
    state = applyEndTurn(applyEndTurn(state).state).state;
    assert.equal(state.spells.bond.available, true);
});

test('Transposition swaps the two fighters, even without line of sight', () => {
    let state = duel(['sacrieur', 'cra'], [0, 0], [3, 1]);
    const [a, b] = [cell(state, 0), cell(state, 1)];
    state = cast(state, 'transposition', 3, 1).state;
    assert.deepEqual([cell(state, 0), cell(state, 1)], [b, a]);
});

test('Mot soignant heals the caster, up to its maximum health', () => {
    let state = withFighter(duel(['eniripsa', 'cra'], [0, 0], [4, 4]), 0, { health: 50 });
    state = applyMove(state, at(state, 0, 1)).state; // recalcule les options
    state = cast(state, 'mot-soignant', 0, 1, MAX).state;
    assert.equal(hp(state, 0), 50 + 18);
    let full = duel(['eniripsa', 'cra'], [0, 0], [4, 4]);
    full = cast(full, 'mot-soignant', 0, 0, MAX).state;
    assert.equal(hp(full, 0), 95);
});

test('Flèche glacée: the target has 2 PA less on its next turn', () => {
    let state = duel(['cra', 'iop'], [0, 0], [3, 0]);
    state = cast(state, 'fleche-glacee', 3, 0).state;
    state = applyEndTurn(state).state;
    assert.equal(state.fighters[1].pa, BASE_PA - 2);
    state = applyEndTurn(applyEndTurn(state).state).state;
    assert.equal(state.fighters[1].pa, BASE_PA);
});

test('Mot stimulant: 2 more PA on the caster\'s next turn', () => {
    let state = duel(['eniripsa', 'cra'], [0, 0], [4, 4]);
    state = cast(state, 'mot-stimulant', 0, 0).state;
    assert.equal(state.fighters[0].pa, BASE_PA - 2);
    state = applyEndTurn(applyEndTurn(state).state).state;
    assert.equal(state.fighters[0].pa, BASE_PA + 2);
});

test('Flèche explosive hits every fighter in a radius of 1 around the target cell', () => {
    let state = duel(['cra', 'iop'], [0, 0], [4, 0]);
    assert.ok(state.spells['fleche-explosive'].valid.includes(at(state, 4, 1))); // case vide
    state = cast(state, 'fleche-explosive', 4, 1).state;
    assert.equal(hp(state, 1), 110 - 9);
    state = duel(['cra', 'iop'], [0, 0], [4, 0]);
    state = cast(state, 'fleche-explosive', 3, 2).state; // à 2 pas de l'Iop : hors zone
    assert.equal(hp(state, 1), 110);
});

test('Absorption heals the caster by half the damage dealt', () => {
    let state = withFighter(duel(['sacrieur', 'cra'], [0, 0], [2, 0]), 0, { health: 100 });
    state = applyMove(state, at(state, 0, 1)).state;
    state = applyMove(state, at(state, 0, 0)).state;
    state = cast(state, 'absorption', 2, 0, MAX).state;
    assert.equal(hp(state, 1), 90 - 14);
    assert.equal(hp(state, 0), 100 + 7);
});

test('Châtiment: every hit taken gives +10 % damage while it lasts', () => {
    let state = duel(['sacrieur', 'iop'], [0, 0], [1, 0]);
    state = cast(state, 'chatiment', 0, 0).state;
    state = applyEndTurn(state).state;                       // à l'Iop
    state = cast(state, 'pression', 0, 0).state;
    state = cast(state, 'pression', 0, 0).state;             // 2 coups reçus
    assert.equal(state.fighters[0].punishment.stacks, 2);
    state = applyEndTurn(state).state;                       // au Sacrieur
    state = cast(state, 'absorption', 1, 0, MIN).state;
    assert.equal(hp(state, 1), 110 - Math.round(11 * 1.2));
});

test('Colère de Iop: 6 PA, once every 3 turns', () => {
    let state = duel(['iop', 'cra'], [0, 0], [1, 0]);
    state = cast(state, 'colere', 1, 0).state;
    assert.equal(hp(state, 1), 90 - 34);
    assert.equal(state.fighters[0].pa, 0);
    state = applyEndTurn(applyEndTurn(state).state).state;
    assert.equal(state.spells.colere.cooldown, 2);
});
