import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, CHARACTER_CLASS, CHARACTER_CLASS_LABEL } from '../src/Models/Player.js';
import { PlayersRepository, CLASS_TEMPLATES, STAT_BUDGET } from '../src/Repository/PlayersRepository.js';

// ─── Lot 5 : classes de personnage (docs/spec-game-design.md §7) ──────────────

test('a player has no class by default', () => {
    assert.equal(createPlayer('Test', 100, 't.png', 3).characterClass, null);
    assert.equal(createPlayer('Test', 100, 't.png', 3, { characterClass: CHARACTER_CLASS.ENT }).characterClass, 'ent');
});

test('every class has a template within the common budget and a French label', () => {
    for (const cls of Object.values(CHARACTER_CLASS)) {
        const t = CLASS_TEMPLATES[cls];
        assert.ok(t, cls);
        assert.equal(t.strength + t.agility + t.luck, STAT_BUDGET, cls);
        assert.equal(typeof CHARACTER_CLASS_LABEL[cls], 'string', cls);
    }
});

test('every character has a class, the class PM, the budget, and differs from its template by at most one point', () => {
    for (const p of PlayersRepository.findAll()) {
        const t = CLASS_TEMPLATES[p.characterClass];
        assert.ok(t, `${p.name}: unknown class ${p.characterClass}`);
        assert.equal(p.maxMove, t.maxMove, `${p.name}: PM`);
        assert.equal(p.strength + p.agility + p.luck, STAT_BUDGET, `${p.name}: budget`);
        const moved = ['strength', 'agility', 'luck'].reduce((sum, k) => sum + Math.abs(p[k] - t[k]), 0);
        assert.ok(moved <= 2, `${p.name}: ${moved / 2} points moved`);
        assert.ok(['strength', 'agility', 'luck'].every(k => p[k] >= 0), `${p.name}: negative stat`);
    }
});

test('every class has at least three characters', () => {
    const players = PlayersRepository.findAll();
    for (const cls of Object.values(CHARACTER_CLASS)) {
        assert.ok(players.filter(p => p.characterClass === cls).length >= 3, cls);
    }
});
