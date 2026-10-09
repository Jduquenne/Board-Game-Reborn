// Entraîne le déplacement de l'IA Expert par algorithme génétique (caractéristiques Expert, src/AI/ExpertMoveFeatures.js).
//
// Usage :   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/train-expert.mjs
//               [--generations 40] [--games 200] [--seed 1] [--start champion|expert]
//   --start champion : part du champion génétique (IA Difficile), nouveaux poids à 0
//   --start expert   : reprend les poids Expert livrés (DefaultModels.js) pour les améliorer
// Note (fitness) d'un individu : moyenne de ses victoires contre l'IA Difficile et contre l'IA Normal.
// Sortie :  progression, niveau final (2 000 parties, graine 777), poids à recopier dans
//           src/AI/DefaultModels.js (EXPERT_MOVE_WEIGHTS) et dans ../BoardGameReborn-output/training/expert-model.json

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MoveTrainer } from '../src/AI/MoveTrainer.js';
import { EXPERT_MOVE_FEATURES, createExpertMoveAgent } from '../src/AI/ExpertMoveFeatures.js';
import { CHAMPION_MOVE_WEIGHTS, EXPERT_MOVE_WEIGHTS } from '../src/AI/DefaultModels.js';
import { AI_LEVELS } from '../src/AI/Levels.js';
import { SCRIPTED_AGENTS } from '../src/AI/ScriptedAgents.js';
import { runMatch } from '../src/AI/Arena.js';
import { createRng } from '../src/core/Random.js';

const args = process.argv.slice(2);
const arg  = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };

const GENERATIONS = Number(arg('generations', 40));
const GAMES       = Number(arg('games', 200));
const SEED        = Number(arg('seed', 1));
const START       = arg('start', 'champion');
const pct         = x => `${(x * 100).toFixed(1).padStart(5)} %`;

const size  = EXPERT_MOVE_FEATURES.length;
const start = START === 'expert'
    ? [...EXPERT_MOVE_WEIGHTS]
    : [...CHAMPION_MOVE_WEIGHTS, ...Array(size - CHAMPION_MOVE_WEIGHTS.length).fill(0)];

// Population de départ : le point de départ + des variantes proches (15) et plus lointaines (14)
const rng = createRng(SEED + 99);
const initial = Array.from({ length: 30 }, (_, i) => (i === 0 ? start : start.map(w => w + (rng() - 0.5) * (i < 15 ? 0.6 : 2))));

const hard   = AI_LEVELS.hard;
const normal = SCRIPTED_AGENTS.normal;
const trainer = new MoveTrainer({
    opponent: hard, sparring: [normal], seed: SEED, gamesPerIndividual: GAMES,
    genomeSize: size, makeAgent: genome => createExpertMoveAgent(genome), gaOptions: { initial },
});
const level = genome => ({
    hard:   runMatch(createExpertMoveAgent(genome), hard, { games: 2000, seed: 777 }).winRateA,
    normal: runMatch(createExpertMoveAgent(genome), normal, { games: 2000, seed: 777 }).winRateA,
});

const before = level(start);
console.log(`Start (${START}): vs IA Difficile ${pct(before.hard)} · vs IA Normal ${pct(before.normal)}\n`);
console.log('gen'.padStart(4) + 'best fit'.padStart(10) + 'avg fit'.padStart(10) + 'games'.padStart(10));

const t = performance.now();
for (let g = 0; g < GENERATIONS; g++) {
    const r = trainer.nextGeneration();
    console.log(String(r.generation).padStart(4) + pct(r.best.fitness).padStart(10) + pct(r.average).padStart(10) + String(trainer.gamesPlayed).padStart(10));
}
console.log(`\n${GENERATIONS} generations in ${((performance.now() - t) / 1000).toFixed(0)} s`);

const after = level(trainer.bestGenome);
console.log(`Champion: vs IA Difficile ${pct(after.hard)} · vs IA Normal ${pct(after.normal)} (2,000 games, seed 777)\n`);
EXPERT_MOVE_FEATURES.forEach((f, i) => console.log(`    ${String(trainer.bestGenome[i]).padEnd(22)}, // ${f.label}`));

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'BoardGameReborn-output', 'training');
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'expert-model.json'), JSON.stringify({ features: EXPERT_MOVE_FEATURES.map(f => f.key), weights: trainer.bestGenome }, null, 1));
console.log(`\nModel saved to ${join(OUT_DIR, 'expert-model.json')}`);
