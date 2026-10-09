import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { WEAPON_TYPE } from '../src/Models/Weapon.js';
import { WeaponsRepository } from '../src/Repository/WeaponsRepository.js';
import { weaponDamage, criticalChance, applyAttack } from '../src/Engine/Rules.js';
import { setBoard, setFight, createWeapon } from './helpers.mjs';

// ─── Lot 4 : types d'armes (docs/spec-game-design.md §5) ─────────────────────

const { HEAVY, LIGHT, BALANCED } = WEAPON_TYPE;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≠ ${expected}`);

test('a weapon is balanced by default; every weapon of the game has a known type', () => {
    assert.equal(createWeapon('w', 10, 'w.png').type, BALANCED);
    const types = WeaponsRepository.findAll().map(w => w.type);
    assert.ok(types.every(t => [HEAVY, LIGHT, BALANCED].includes(t)), types.join());
    for (const t of [HEAVY, LIGHT, BALANCED]) assert.equal(types.filter(x => x === t).length, 4, t);
});

test('a heavy weapon gets 7 % per strength point instead of 5 %', () => {
    const heavy    = createWeapon('h', 40, 'h.png', HEAVY);
    const balanced = createWeapon('b', 40, 'b.png', BALANCED);
    const light    = createWeapon('l', 40, 'l.png', LIGHT);
    assert.equal(weaponDamage({ strength: 5 }, heavy), 54);    // 40 × 1,35
    assert.equal(weaponDamage({ strength: 5 }, balanced), 50); // 40 × 1,25
    assert.equal(weaponDamage({ strength: 5 }, light), 50);
    assert.equal(weaponDamage({ strength: 0 }, heavy), 40, 'no bonus without strength');
});

test('a light weapon adds 10 % critical chance, capped at 50 % instead of 40 %', () => {
    const light = createWeapon('l', 20, 'l.png', LIGHT);
    const heavy = createWeapon('h', 20, 'h.png', HEAVY);
    close(criticalChance({ agility: 0 }, light), 0.10);
    close(criticalChance({ agility: 5 }, light), 0.25);
    assert.equal(criticalChance({ agility: 20 }, light), 0.50);
    assert.equal(criticalChance({ agility: 0 }, heavy), 0);
    assert.equal(criticalChance({ agility: 20 }, heavy), 0.40);
    close(criticalChance({ agility: 5, weapon: light }), 0.25, 'uses the held weapon by default');
});

test('an attack with a light weapon can be critical without agility', () => {
    setBoard({ players: [
        { row: 0, col: 0, weapon: createWeapon('l', 40, 'l.png', LIGHT) },
        { row: 0, col: 1, health: 200 },
    ] });
    setFight(0, 1);
    const { events: emitted } = applyAttack(store.state, () => 0.05); // 0,05 < 10 %
    assert.equal(emitted[0].payload.critical, true);
    assert.equal(emitted[0].payload.damage, 60);
});

test('an attack with a heavy weapon uses the stronger strength bonus', () => {
    setBoard({ players: [
        { row: 0, col: 0, strength: 5, weapon: createWeapon('h', 40, 'h.png', HEAVY) },
        { row: 0, col: 1, health: 200 },
    ] });
    setFight(0, 1);
    const rng = () => { throw new Error('no random draw expected'); };
    const { state, events: emitted } = applyAttack(store.state, rng);
    assert.equal(emitted[0].payload.damage, 54);
    assert.equal(state.players[1].player.health, 146);
});
