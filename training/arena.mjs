// Arène en ligne de commande : fait s'affronter les agents deux à deux et affiche les taux de victoire.
//
// Usage :   node training/arena.mjs [--games 200] [--seed 1] [--godlike 0]
//   --godlike N : ajoute l'IA Godlike sur N parties par rencontre (≈ 0,1 s par décision : lent)
// (ajouter --disable-warning=MODULE_TYPELESS_PACKAGE_JSON après `node` pour masquer l'avertissement de Node)

import { runMatch } from '../src/AI/Arena.js';
import { SCRIPTED_AGENTS } from '../src/AI/ScriptedAgents.js';
import { AI_LEVELS } from '../src/AI/Levels.js';

const args    = process.argv.slice(2);
const arg     = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : fallback; };
const GAMES   = arg('games', 200);
const SEED    = arg('seed', 1);
const GODLIKE = arg('godlike', 0);

const agents = [...Object.values(SCRIPTED_AGENTS), AI_LEVELS.hard, AI_LEVELS.expert, ...(GODLIKE ? [AI_LEVELS.godlike] : [])];
const pct    = x => `${(x * 100).toFixed(1).padStart(5)} %`;

console.log(`Arena — ${GAMES} games per pairing, seed ${SEED}, seats alternated\n`);
console.log('A'.padEnd(8) + 'B'.padEnd(8) + 'A wins'.padStart(9) + 'B wins'.padStart(9) + 'draws'.padStart(9) + 'avg turns'.padStart(11));

const start = performance.now();
let totalGames = 0;

for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
        const games = agents[j] === AI_LEVELS.godlike ? GODLIKE : GAMES;
        const r = runMatch(agents[i], agents[j], { games, seed: SEED });
        totalGames += r.games;
        console.log(
            agents[i].name.padEnd(8) + agents[j].name.padEnd(8) +
            pct(r.winsA / r.games).padStart(9) + pct(r.winsB / r.games).padStart(9) +
            pct(r.draws / r.games).padStart(9) + r.avgTurns.toFixed(1).padStart(11),
        );
    }
}

const seconds = (performance.now() - start) / 1000;
console.log(`\n${totalGames} games in ${seconds.toFixed(2)} s (${Math.round(totalGames / seconds)} games/s)`);
