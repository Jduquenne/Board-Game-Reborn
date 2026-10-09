import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/core/Store.js';
import { createPlayer } from '../src/Models/Player.js';
import {
    castableSpells, applySpell, applyPass, resolveRound, fleeOptions, healAmount, SPELL_COST, ROOT_ACTIONS,
} from '../src/Engine/Rules.js';
import { normalAgent } from '../src/AI/ScriptedAgents.js';
import { allowedFightActions } from '../src/AI/FightPolicy.js';
import { setBoard, setFight, createWeapon } from './helpers.mjs';

// ─── Lot 8 : Intelligence, mana et sorts (docs/spec-game-design.md §6) ────────

test('mana = intelligence × 10, full at the start', () => {
    const p = createPlayer('Mage', 100, 'm.png', 3, { intelligence: 6 });
    assert.deepEqual([p.mana, p.maxMana, p.rooted], [60, 60, 0]);
    assert.equal(createPlayer('Brute', 100, 'b.png', 2).maxMana, 0);
});

// Combat : le joueur 0 (lanceur) attaque le joueur 1 ; le joueur 1 a 2 cases de repli possibles
const fight = ({ caster = {}, target = {} } = {}) => {
    setBoard({ players: [
        { row: 2, col: 2, intelligence: 6, mana: 60, maxMana: 60, ...caster },
        { row: 2, col: 3, ...target },
    ] });
    setFight(0, 1);
    return store.state;
};

test('spells need enough mana; heal is not offered at full health', () => {
    assert.deepEqual(castableSpells(fight()), ['root']);
    assert.deepEqual(castableSpells(fight({ caster: { health: 50 } })), ['heal', 'root']);
    assert.deepEqual(castableSpells(fight({ caster: { health: 50, mana: SPELL_COST - 1 } })), []);
    const refused = fight({ caster: { health: 50, mana: 0 } });
    assert.equal(applySpell(refused, 'heal').state, refused, 'refused without mana');
});

test('heal restores 10 + 3 × intelligence health, up to the starting health, and costs 20 mana', () => {
    assert.equal(healAmount({ intelligence: 6 }), 28);
    const { state, events } = applySpell(fight({ caster: { health: 50, defense: true } }), 'heal');
    const me = state.players[0].player;
    assert.deepEqual([me.health, me.mana, me.defense], [78, 40, false]);
    assert.equal(events[0].name, 'fight:spell');
    assert.deepEqual([events[0].payload.spell, events[0].payload.amount], ['heal', 28]);

    const capped = applySpell(fight({ caster: { health: 90 } }), 'heal');
    assert.equal(capped.state.players[0].player.health, 100);
    assert.equal(capped.events[0].payload.amount, 10);
});

test('root prevents the target from fleeing for its next 3 fight actions', () => {
    const { state } = applySpell(fight(), 'root');
    assert.equal(state.players[1].player.rooted, ROOT_ACTIONS);
    assert.equal(state.players[0].player.mana, 40);

    // Au tour du joueur entravé : aucune case de repli, donc pas d'action « fuir »
    let s = resolveRound(state, 0, 1).state;
    assert.deepEqual(fleeOptions(s), []);
    assert.ok(!allowedFightActions(s).includes('flee'));

    // Chacune de ses actions consomme l'entrave ; après 3 actions il peut de nouveau fuir
    for (let i = 0; i < ROOT_ACTIONS; i++) {
        s = resolveRound(s, 1, 0).state; // il agit
        s = resolveRound(s, 0, 1).state; // l'autre agit
    }
    assert.equal(s.players[1].player.rooted, 0);
    assert.ok(fleeOptions(s).length > 0);
});

test('mana comes back by intelligence points at the start of each turn, up to the maximum', () => {
    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4, intelligence: 6, mana: 10, maxMana: 60 }] });
    let { state } = applyPass(store.state);
    assert.equal(state.players[1].player.mana, 16);
    assert.equal(state.cells[4][4].player.mana, 16, 'the cell shows the same player');

    setBoard({ players: [{ row: 0, col: 0 }, { row: 4, col: 4, intelligence: 6, mana: 58, maxMana: 60 }] });
    ({ state } = applyPass(store.state));
    assert.equal(state.players[1].player.mana, 60);
});

test('Normal AI heals when the next enemy hit is lethal and the heal saves it', () => {
    const state = fight({
        caster: { health: 15 },
        target: { weapon: createWeapon('w20', 20, 'w.png') },
    });
    assert.equal(normalAgent.chooseFightAction(state), 'heal'); // 15 + 28 = 43 > 20
});

test('Normal AI roots an enemy it can finish in two hits', () => {
    const state = fight({
        caster: { weapon: createWeapon('w20', 20, 'w.png') },
        target: { health: 35 },
    });
    assert.equal(normalAgent.chooseFightAction(state), 'root');
    const rooted = fight({ caster: { weapon: createWeapon('w20', 20, 'w.png') }, target: { health: 35, rooted: 2 } });
    assert.equal(normalAgent.chooseFightAction(rooted), 'attack', 'no second root while the first one lasts');
});
