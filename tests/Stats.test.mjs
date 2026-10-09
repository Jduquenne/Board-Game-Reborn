import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { createPlayer } from '../src/Models/Player.js';
import { PlayersRepository } from '../src/Repository/PlayersRepository.js';
import { weaponDamage, applyAttack, criticalChance, dodgeChance } from '../src/Engine/Rules.js';
import { fightEngine } from '../src/Engine/FightEngine.js';
import { normalAgent } from '../src/AI/ScriptedAgents.js';
import { fightStateKey } from '../src/AI/FightPolicy.js';
import { runBalance } from '../src/AI/Balance.js';
import { setBoard, setFight, recordEvents, createWeapon } from './helpers.mjs';

// ─── Modèle ───────────────────────────────────────────────────────────────────

test('a player has combat stats, 0 by default', () => {
    const p = createPlayer('Test', 100, 'test.png', 3);
    assert.deepEqual([p.strength, p.agility, p.intelligence, p.luck], [0, 0, 0, 0]);

    const q = createPlayer('Test', 100, 'test.png', 3, { strength: 4, agility: 2, intelligence: 1, luck: 3 });
    assert.deepEqual([q.strength, q.agility, q.intelligence, q.luck], [4, 2, 1, 3]);
});

test('every character of the game has its combat stats', () => {
    for (const p of PlayersRepository.findAll()) {
        for (const stat of ['strength', 'agility', 'intelligence', 'luck']) {
            assert.equal(typeof p[stat], 'number', `${p.name}.${stat}`);
        }
    }
});

// ─── Force dans les dégâts ────────────────────────────────────────────────────

test('strength adds 5 % weapon damage per point, rounded', () => {
    const excalibur = createWeapon('Excalibur', 40, 'e.png');
    assert.equal(weaponDamage({ strength: 0, weapon: excalibur }), 40);
    assert.equal(weaponDamage({ strength: 10, weapon: excalibur }), 60);
    assert.equal(weaponDamage({ strength: 3, weapon: createWeapon('Skyword', 15, 's.png') }), 17); // 17,25 → 17
    assert.equal(weaponDamage({ weapon: excalibur }), 40, 'a player without the stat counts as 0');
    assert.equal(weaponDamage({ strength: 10, weapon: excalibur }, createWeapon('Aiguille', 30, 'a.png')), 45, 'another weapon');
});

let events;
beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
afterEach(() => { mock.timers.reset(); events?.stop(); });

test('an attack uses the strength, and defense halves the result', () => {
    setBoard({ players: [
        { row: 0, col: 0, strength: 10, weapon: createWeapon('Excalibur', 40, 'e.png') },
        { row: 0, col: 1, health: 100, defense: true },
    ] });
    setFight(0, 1);
    events = recordEvents(['fight:attack']);

    fightEngine.attack();

    assert.equal(events.log[0].payload.damage, 30, '40 × 1.5 = 60, halved by defense');
    assert.equal(store.state.players[1].player.health, 70);
});

// ─── Les IA tiennent compte de la Force ───────────────────────────────────────

test('the normal AI counts strength when it can finish the enemy', () => {
    // 40 de dégâts ne tuent pas 50 PV… mais 40 × (1 + 5 × 5 %) = 50, si
    const scenario = strength => {
        setBoard({ players: [
            { row: 0, col: 0, health: 50, weapon: createWeapon('w40', 40, 'w.png') },
            { row: 0, col: 1, health: 30, strength, weapon: createWeapon('w40', 40, 'w.png') },
        ] });
        setFight(1, 0);
        return normalAgent.chooseFightAction(store.state);
    };
    assert.equal(scenario(0), 'flee', 'without strength: not lethal, and the enemy can kill → flee (escape possible)');
    assert.equal(scenario(5), 'attack', 'with strength 5: lethal hit');
});

test('the fight observation counts hits with strength', () => {
    setBoard({ players: [
        { row: 0, col: 0, strength: 10, weapon: createWeapon('w40', 40, 'w.png') },
        { row: 0, col: 1, health: 120 },
    ] });
    setFight(0, 1);
    assert.equal(fightStateKey(store.state).split('|')[0], '2', '120 HP / 60 damage = 2 hits (3 without strength)');
});

test('strength makes a character stronger in the balance analysis', () => {
    const char = (name, strength) => ({ name, health: 100, maxMove: 3, strength, image: `${name}.png` });
    const { characters } = runBalance({ characters: [char('Strong', 10), char('Weak', 0)], agent: normalAgent, gamesPerPair: 200 });
    assert.ok(characters[0].winRate > 0.65, `strong win rate ${characters[0].winRate}`);
    assert.equal(characters[0].strength, 10);
});

// ─── Lot 2 : coups critiques (Agilité) et esquive (Chance) ────────────────────


const attackState = ({ attacker = {}, target = {} } = {}) => {
    setBoard({ players: [
        { row: 0, col: 0, weapon: createWeapon('w40', 40, 'w.png'), ...attacker },
        { row: 0, col: 1, health: 200, ...target },
    ] });
    setFight(0, 1);
    return store.state;
};
const fixedRng = value => {
    const rng = () => { rng.calls++; return value; };
    rng.calls = 0;
    return rng;
};

test('critical and dodge chances grow by 3 % per point, up to a cap', () => {
    assert.equal(criticalChance({ agility: 0 }), 0);
    assert.ok(Math.abs(criticalChance({ agility: 5 }) - 0.15) < 1e-12);
    assert.equal(criticalChance({ agility: 20 }), 0.40);
    assert.ok(Math.abs(dodgeChance({ luck: 5 }) - 0.15) < 1e-12);
    assert.equal(dodgeChance({ luck: 20 }), 0.35);
    assert.equal(dodgeChance({}), 0, 'missing stat counts as 0');
});

test('without agility nor luck, no random draw is made', () => {
    const rng = fixedRng(0);
    const { events: emitted } = applyAttack(attackState(), rng);
    assert.equal(rng.calls, 0);
    assert.deepEqual([emitted[0].payload.damage, emitted[0].payload.critical, emitted[0].payload.dodged], [40, false, false]);
});

test('a dodge cancels the damage', () => {
    const { state, events: emitted } = applyAttack(attackState({ target: { luck: 10 } }), fixedRng(0.1)); // 0,1 < 30 %
    assert.equal(emitted[0].payload.dodged, true);
    assert.equal(emitted[0].payload.damage, 0);
    assert.equal(state.players[1].player.health, 200);
});

test('a dodge fails when the draw is above the chance', () => {
    const { events: emitted } = applyAttack(attackState({ target: { luck: 10 } }), fixedRng(0.5)); // 0,5 ≥ 30 %
    assert.equal(emitted[0].payload.dodged, false);
    assert.equal(emitted[0].payload.damage, 40);
});

test('a critical hit multiplies the damage by 2, before the defense halves it', () => {
    let r = applyAttack(attackState({ attacker: { agility: 10 } }), fixedRng(0.1)); // 0,1 < 30 %
    assert.deepEqual([r.events[0].payload.critical, r.events[0].payload.damage], [true, 80]);

    r = applyAttack(attackState({ attacker: { agility: 10 }, target: { defense: true } }), fixedRng(0.1));
    assert.equal(r.events[0].payload.damage, 40, '80 halved');

    r = applyAttack(attackState({ attacker: { agility: 10, strength: 10 } }), fixedRng(0.1));
    assert.equal(r.events[0].payload.damage, 120, '40 × 1.5 (strength) × 2 (critical)');
});

test('a dodged attack cannot be critical', () => {
    const { events: emitted } = applyAttack(attackState({ attacker: { agility: 10 }, target: { luck: 10 } }), fixedRng(0));
    assert.deepEqual([emitted[0].payload.dodged, emitted[0].payload.critical, emitted[0].payload.damage], [true, false, 0]);
});

test('agility and luck make a character stronger, reproducibly', () => {
    const char = (name, stats) => ({ name, health: 100, maxMove: 3, image: `${name}.png`, ...stats });
    const run = stats => runBalance({ characters: [char('A', stats), char('B', {})], agent: normalAgent, gamesPerPair: 200, seed: 3 });

    assert.ok(run({ agility: 10 }).characters[0].winRate > 0.55, 'agility');
    assert.ok(run({ luck: 10 }).characters[0].winRate > 0.55, 'luck');
    assert.deepEqual(run({ agility: 5, luck: 5 }), run({ agility: 5, luck: 5 }), 'same seed, same result');
});
