import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalAgent, randomAgent, applyAction } from '../src/AI/Tactical/TacticalAgents.js';
import { playTacticalFight, MAX_TURNS } from '../src/AI/Tactical/TacticalArena.js';
import { createTacticalGame } from '../src/Engine/Tactical/TacticalRules.js';
import { TacticalClassesRepository } from '../src/Repository/TacticalClassesRepository.js';
import { createRng } from '../src/core/Random.js';
import { duel, at, withFighter } from './tacticalHelpers.mjs';

const CLASSES = TacticalClassesRepository.findAll().map(c => c.id);

test('Normal beats the random agent with every class (and only plays legal actions)', () => {
    const rng = createRng(11);
    let wins = 0, fights = 0;
    for (const a of CLASSES) {
        for (const b of CLASSES) {
            for (const seat of [0, 1]) {
                const agents = seat === 0 ? [normalAgent, randomAgent] : [randomAgent, normalAgent];
                const r = playTacticalFight({ classes: [a, b], agents, rng }); // lève une erreur sur une action illégale
                fights++;
                if (r.winnerIndex === seat) wins++;
            }
        }
    }
    assert.ok(wins / fights >= 0.9, `${wins} / ${fights}`);
});

test('Normal against Normal: every fight ends, before the safety limit', () => {
    const rng = createRng(5);
    for (const a of CLASSES) {
        const r = playTacticalFight({ classes: [a, CLASSES[(CLASSES.indexOf(a) + 1) % CLASSES.length]], agents: [normalAgent, normalAgent], rng });
        assert.notEqual(r.winnerIndex, null);
        assert.ok(r.turns < MAX_TURNS);
    }
});

test('same seed → same fight', () => {
    const play = () => playTacticalFight({ classes: ['cra', 'sacrieur'], agents: [normalAgent, normalAgent], rng: createRng(9) });
    assert.deepEqual(play(), play());
});

test('Normal places itself on a free placement cell of its colour', () => {
    const state = createTacticalGame({ classes: ['iop', 'cra'] }, createRng(1));
    for (const index of [0, 1]) {
        const cellId = normalAgent.choosePlacement(state, index);
        assert.equal(state.board.cells[cellId].placement, state.fighters[index].team);
        assert.ok(!state.fighters.some((f, i) => i !== index && f.cellId === cellId));
    }
});

test('Normal finishes a weak enemy in reach', () => {
    const state = withFighter(duel(['iop', 'cra'], [0, 0], [1, 0]), 1, { health: 10 });
    const fresh = applyAction(state, { type: 'move', cellId: at(state, 0, 1) }).state; // recalcule les options
    const back = applyAction(fresh, { type: 'move', cellId: at(state, 0, 0) }).state;
    const action = normalAgent.chooseAction(back, 0);
    assert.equal(action.type, 'cast');
    assert.equal(action.cellId, back.fighters[1].cellId);
});

test('Normal Crâ shoots from a distance instead of walking into melee', () => {
    const state = duel(['cra', 'iop'], [0, 0], [5, 0]);
    let s = state;
    const actions = [];
    for (let i = 0; i < 10 && s.activeIndex === 0; i++) {
        const action = normalAgent.chooseAction(s, 0);
        actions.push(action);
        if (action.type === 'end') break;
        s = applyAction(s, action, () => 0.5).state;
    }
    assert.ok(actions.some(a => a.type === 'cast' && a.spellId.startsWith('fleche')));
    assert.ok(s.fighters[1].health < state.fighters[1].health);
});

test('the random agent only proposes legal actions', () => {
    const state = duel(['eniripsa', 'iop'], [0, 0], [2, 0]);
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
        const action = randomAgent.chooseAction(state, 0, rng);
        if (action.type === 'end') continue;
        assert.notEqual(applyAction(state, action, rng).state, state);
    }
});
