import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceSteps, runBalance } from '../src/AI/Balance.js';
import { normalAgent } from '../src/AI/ScriptedAgents.js';

const char = (name, health, maxMove) => ({ name, health, maxMove, image: `${name}.png` });

test('the analysis reports progress pair by pair, then the full result', () => {
    const characters = [char('A', 100, 3), char('B', 100, 3), char('C', 100, 3)];
    const steps = balanceSteps({ characters, agent: normalAgent, gamesPerPair: 4 });

    const progress = [];
    let step = steps.next();
    while (!step.done) { progress.push(step.value); step = steps.next(); }

    assert.deepEqual(progress.map(p => p.pairsDone), [1, 2, 3]);
    assert.ok(progress.every(p => p.pairsTotal === 3));
    assert.equal(step.value.games, 12);
});

test('the matrix has an empty diagonal and complementary results', () => {
    const characters = [char('A', 100, 3), char('B', 150, 2), char('C', 75, 4)];
    const { matrix, drawRate } = runBalance({ characters, agent: normalAgent, gamesPerPair: 20 });

    assert.equal(matrix.length, 3);
    matrix.forEach((row, i) => assert.equal(row[i], null));
    for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
            assert.ok(matrix[i][j] + matrix[j][i] <= 1, 'wins of both sides cannot exceed the games played');
        }
    }
    assert.ok(drawRate >= 0 && drawRate <= 1);
});

test('identical characters are balanced', () => {
    const { characters } = runBalance({ characters: [char('A', 100, 3), char('B', 100, 3)], agent: normalAgent, gamesPerPair: 400 });
    for (const c of characters) assert.ok(Math.abs(c.winRate - 0.5) < 0.08, `${c.name}: ${c.winRate}`);
});

test('more health wins more often (with an AI that engages)', () => {
    const { characters } = runBalance({ characters: [char('Tank', 300, 3), char('Weak', 100, 3)], agent: normalAgent, gamesPerPair: 200 });
    assert.ok(characters[0].winRate > 0.75, `tank win rate ${characters[0].winRate}`);
    assert.equal(characters[0].best.name, 'Weak');
});

test('the analysis is reproducible with the same seed', () => {
    const characters = [char('A', 100, 3), char('B', 120, 2)];
    const run = seed => runBalance({ characters, agent: normalAgent, gamesPerPair: 30, seed });
    assert.deepEqual(run(4), run(4));
});
