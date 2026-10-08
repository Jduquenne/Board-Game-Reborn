// Entraîne les décisions de combat par Q-learning et affiche la progression.
//
// Usage :   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/train-fight.mjs [--games 50000] [--seed 1] [--opponent normal]
// Sortie :  courbe de progression (évaluation régulière) + politique apprise + modèle dans
//           ../BoardGameReborn-output/training/fight-model.json (à côté du projet)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FightTrainer } from '../src/AI/FightTrainer.js';
import { describeFightKey } from '../src/AI/FightPolicy.js';
import { SCRIPTED_AGENTS } from '../src/AI/ScriptedAgents.js';
import { runMatch } from '../src/AI/Arena.js';

const args = process.argv.slice(2);
const arg  = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };

const GAMES    = Number(arg('games', 50000));
const SEED     = Number(arg('seed', 1));
const OPPONENT = SCRIPTED_AGENTS[arg('opponent', 'normal')];
const EVERY    = Math.max(1, Math.round(GAMES / 20));
const pct      = x => `${(x * 100).toFixed(1).padStart(5)} %`;

const trainer = new FightTrainer({ opponent: OPPONENT, seed: SEED });

// Référence : l'IA normale (même déplacement, combat écrit à la main) contre l'adversaire, mêmes parties d'évaluation
const ref = runMatch(SCRIPTED_AGENTS.normal, OPPONENT, { games: 400, seed: 777 });
console.log(`Reference — scripted "normal" fights vs ${OPPONENT.name}: wins ${pct(ref.winsA / 400)}, draws ${pct(ref.draws / 400)}\n`);

console.log('games'.padStart(8) + 'epsilon'.padStart(9) + 'eval wins'.padStart(11) + 'draws'.padStart(9) + 'losses'.padStart(9) + 'states'.padStart(8));
const show = () => {
    const e = trainer.evaluate(400);
    console.log(
        String(trainer.gamesPlayed).padStart(8) + trainer.qtable.epsilon.toFixed(3).padStart(9) +
        pct(e.winRate).padStart(11) + pct(e.drawRate).padStart(9) + pct(e.lossRate).padStart(9) +
        String(trainer.qtable.size).padStart(8),
    );
};

const start = performance.now();
show();
while (trainer.gamesPlayed < GAMES) {
    trainer.train(Math.min(EVERY, GAMES - trainer.gamesPlayed));
    show();
}
const seconds = (performance.now() - start) / 1000;
console.log(`\n${GAMES} training games in ${seconds.toFixed(1)} s`);

// Politique apprise, situation par situation
console.log('\nLearned policy (situation → action, Q values attack / defend):');
for (const { key, values } of trainer.qtable.entries().sort((a, b) => a.key.localeCompare(b.key))) {
    const best = values[0] >= values[1] ? 'attack' : 'defend';
    console.log(`  ${best.padEnd(7)} ${values.map(v => v.toFixed(2).padStart(6)).join(' ')}   ${describeFightKey(key).text}`);
}

// À côté du projet (pas dedans : Live Server rechargerait la page ; jamais sur le disque C:)
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'BoardGameReborn-output', 'training');
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'fight-model.json'), JSON.stringify(trainer.qtable.toJSON(), null, 1));
console.log(`\nModel saved to ${join(OUT_DIR, 'fight-model.json')}`);
