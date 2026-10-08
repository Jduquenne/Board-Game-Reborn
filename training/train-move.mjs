// Fait évoluer le déplacement de l'IA par algorithme génétique et affiche la progression.
//
// Usage :   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/train-move.mjs [--generations 30] [--seed 1] [--opponent normal]
// Sortie :  progression par génération, poids du champion, modèle dans
//           ../BoardGameReborn-output/training/move-model.json (à côté du projet)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MoveTrainer } from '../src/AI/MoveTrainer.js';
import { MOVE_FEATURES } from '../src/AI/MoveFeatures.js';
import { SCRIPTED_AGENTS } from '../src/AI/ScriptedAgents.js';
import { runMatch } from '../src/AI/Arena.js';

const args = process.argv.slice(2);
const arg  = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };

const GENERATIONS = Number(arg('generations', 30));
const SEED        = Number(arg('seed', 1));
const OPPONENT    = SCRIPTED_AGENTS[arg('opponent', 'normal')];
const pct         = x => `${(x * 100).toFixed(1).padStart(5)} %`;

const trainer = new MoveTrainer({ opponent: OPPONENT, seed: SEED });

const ref = runMatch(SCRIPTED_AGENTS.normal, OPPONENT, { games: 400, seed: 777 });
console.log(`Reference — scripted "normal" vs ${OPPONENT.name} on the evaluation games: wins ${pct(ref.winsA / 400)}\n`);
console.log('gen'.padStart(4) + 'best fit'.padStart(10) + 'avg fit'.padStart(10) + 'eval wins'.padStart(11) + 'draws'.padStart(9) + 'games'.padStart(9));

const start = performance.now();
for (let g = 0; g < GENERATIONS; g++) {
    const report = trainer.nextGeneration();
    const e = trainer.evaluate(400);
    console.log(
        String(report.generation).padStart(4) + pct(report.best.fitness).padStart(10) + pct(report.average).padStart(10) +
        pct(e.winRate).padStart(11) + pct(e.drawRate).padStart(9) + String(trainer.gamesPlayed).padStart(9),
    );
}
console.log(`\n${GENERATIONS} generations in ${((performance.now() - start) / 1000).toFixed(1)} s`);

console.log('\nChampion weights:');
MOVE_FEATURES.forEach((f, i) => console.log(`  ${trainer.bestGenome[i].toFixed(2).padStart(6)}  ${f.label}`));

// À côté du projet (pas dedans : Live Server rechargerait la page ; jamais sur le disque C:)
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'BoardGameReborn-output', 'training');
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'move-model.json'), JSON.stringify({ features: MOVE_FEATURES.map(f => f.key), weights: trainer.bestGenome }, null, 1));
console.log(`\nModel saved to ${join(OUT_DIR, 'move-model.json')}`);
