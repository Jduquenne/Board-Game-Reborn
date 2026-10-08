// Apprend à un réseau de neurones à imiter le champion génétique (apprentissage supervisé).
//
// Usage :   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/train-imitation.mjs [--games 1500] [--epochs 8] [--seed 1]
//           [--lr 0.003] [--hidden 32,16] [--hard]   (--hard : étiquettes dures au lieu de la distillation)
// Sortie :  erreur et précision par époque (apprentissage / test), taux de victoire du réseau,
//           modèle dans ../BoardGameReborn-output/training/neural-move-model.json (à côté du projet)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImitationTrainer } from '../src/AI/ImitationTrainer.js';
import { createWeightedMoveAgent } from '../src/AI/MoveFeatures.js';
import { CHAMPION_MOVE_WEIGHTS } from '../src/AI/DefaultModels.js';
import { SCRIPTED_AGENTS } from '../src/AI/ScriptedAgents.js';
import { runMatch } from '../src/AI/Arena.js';

const args = process.argv.slice(2);
const raw  = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const arg  = (name, fallback) => Number(raw(name, fallback));

const GAMES  = arg('games', 1500);
const EPOCHS = arg('epochs', 8);
const SEED   = arg('seed', 1);
const LR     = arg('lr', 0.003);
const HIDDEN = String(raw('hidden', '32,16')).split(',').map(Number);
const pct    = x => `${(x * 100).toFixed(1).padStart(5)} %`;

const trainer = new ImitationTrainer({ seed: SEED, learningRate: LR, hidden: HIDDEN, distillation: !args.includes('--hard') });
console.log(`Targets: ${trainer.distillation ? `distillation (temperature ${trainer.temperature})` : 'hard labels'}`);
console.log(`Network: ${trainer.network.sizes.join(' → ')} (${trainer.network.parameterCount} parameters)`);

const teacher = runMatch(createWeightedMoveAgent(CHAMPION_MOVE_WEIGHTS), SCRIPTED_AGENTS.normal, { games: 400, seed: 777 });
const normal  = runMatch(SCRIPTED_AGENTS.normal, SCRIPTED_AGENTS.normal, { games: 400, seed: 777 });
console.log(`Teacher (genetic champion) vs normal: ${pct(teacher.winsA / 400)} — normal vs normal: ${pct(normal.winsA / 400)}`);

let start = performance.now();
const sizes = trainer.collect(GAMES);
console.log(`Recorded ${sizes.train} training and ${sizes.test} test decisions from ${GAMES} games in ${((performance.now() - start) / 1000).toFixed(1)} s\n`);

console.log('epoch'.padStart(6) + 'train loss'.padStart(12) + 'train acc'.padStart(11) + 'test loss'.padStart(11) + 'test acc'.padStart(10) + 'wins vs normal'.padStart(16));
const untrained = trainer.measure(trainer.test);
console.log('0'.padStart(6) + '—'.padStart(12) + '—'.padStart(11) + untrained.testLoss.toFixed(3).padStart(11) + pct(untrained.testAccuracy).padStart(10) + pct(trainer.evaluate(400).winRate).padStart(16));

start = performance.now();
for (let e = 0; e < EPOCHS; e++) {
    const r = trainer.trainEpoch();
    console.log(
        String(r.epoch).padStart(6) + r.trainLoss.toFixed(3).padStart(12) + pct(r.trainAccuracy).padStart(11) +
        r.testLoss.toFixed(3).padStart(11) + pct(r.testAccuracy).padStart(10) + pct(trainer.evaluate(400).winRate).padStart(16),
    );
}
console.log(`\n${EPOCHS} epochs in ${((performance.now() - start) / 1000).toFixed(1)} s`);

// À côté du projet (pas dedans : Live Server rechargerait la page ; jamais sur le disque C:)
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'BoardGameReborn-output', 'training');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'neural-move-model.json'), JSON.stringify(trainer.network.toJSON()));
console.log(`Model saved to ${join(outDir, 'neural-move-model.json')}`);
