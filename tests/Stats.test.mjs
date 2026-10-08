import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { createPlayer } from '../src/Models/Player.js';
import { PlayersRepository } from '../src/Repository/PlayersRepository.js';
import { weaponDamage } from '../src/Engine/Rules.js';
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
    assert.equal(scenario(0), 'defend', 'without strength: not lethal, and the enemy can kill → defend');
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
