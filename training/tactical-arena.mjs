// Arène du mode tactique : fait combattre les classes deux à deux avec la même IA des deux côtés,
// puis affiche l'équilibre (taux de victoire par classe, matrice, avantage du premier joueur, durée des combats).
//
// Usage :   node training/tactical-arena.mjs [--games 40] [--seed 1] [--agent normal] [--vs normal]
//   --games N : combats par paire ordonnée de classes (joueur 1 = classe de la ligne) ; 16 paires
//   --agent / --vs : agents des joueurs (normal, random) — par défaut Normal contre Normal
// (ajouter --disable-warning=MODULE_TYPELESS_PACKAGE_JSON après `node` pour masquer l'avertissement de Node)

import { playTacticalFight } from '../src/AI/Tactical/TacticalArena.js';
import { TACTICAL_AGENTS } from '../src/AI/Tactical/TacticalAgents.js';
import { TacticalClassesRepository } from '../src/Repository/TacticalClassesRepository.js';
import { SUDDEN_DEATH_TURN } from '../src/Engine/Tactical/TacticalRules.js';
import { createRng } from '../src/core/Random.js';

const args  = process.argv.slice(2);
const arg   = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const GAMES = Number(arg('games', 40));
const SEED  = Number(arg('seed', 1));
const AGENTS = [TACTICAL_AGENTS[arg('agent', 'normal')], TACTICAL_AGENTS[arg('vs', 'normal')]];
if (AGENTS.some(a => !a)) throw new Error(`Agents connus : ${Object.keys(TACTICAL_AGENTS).join(', ')}`);

const classes = TacticalClassesRepository.findAll();
const pct = x => `${(x * 100).toFixed(1).padStart(5)} %`;
const rng = createRng(SEED);

// wins[a][b] : victoires de la classe a contre la classe b (a joueur 1 ou 2)
const wins  = Object.fromEntries(classes.map(a => [a.id, Object.fromEntries(classes.map(b => [b.id, 0]))]));
const games = Object.fromEntries(classes.map(a => [a.id, Object.fromEntries(classes.map(b => [b.id, 0]))]));
let total = 0, draws = 0, firstWins = 0, turns = 0, sudden = 0, seat1Wins = 0;

console.log(`Tactical arena — ${AGENTS[0].name} (player 1) vs ${AGENTS[1].name} (player 2), ${GAMES} fights per ordered class pair, seed ${SEED}\n`);
const start = performance.now();

for (const a of classes) {
    for (const b of classes) {
        for (let g = 0; g < GAMES; g++) {
            const r = playTacticalFight({ classes: [a.id, b.id], agents: AGENTS, rng });
            total++;
            turns += r.turns;
            if (r.turns >= SUDDEN_DEATH_TURN) sudden++;
            if (r.winnerIndex === null) { draws++; continue; }
            if (r.winnerIndex === r.firstIndex) firstWins++;
            if (r.winnerIndex === 0) seat1Wins++;
            if (a.id === b.id) continue;
            const [winner, loser] = r.winnerIndex === 0 ? [a.id, b.id] : [b.id, a.id];
            wins[winner][loser]++;
            games[a.id][b.id]++;
            games[b.id][a.id]++;
        }
    }
}

console.log('Class'.padEnd(10) + 'win rate (mirrors excluded)');
for (const a of classes) {
    const w = classes.reduce((s, b) => s + wins[a.id][b.id], 0);
    const n = classes.reduce((s, b) => s + games[a.id][b.id], 0);
    console.log(a.name.padEnd(10) + pct(w / n));
}

console.log('\nMatrix: row class wins against column class');
console.log(''.padEnd(10) + classes.map(c => c.name.padStart(10)).join(''));
for (const a of classes) {
    console.log(a.name.padEnd(10) + classes.map(b => a.id === b.id ? '—'.padStart(10) : pct(wins[a.id][b.id] / games[a.id][b.id]).padStart(10)).join(''));
}

const decided = total - draws;
console.log(`\nFirst player (initiative) wins ${pct(firstWins / decided)} · player 1 seat wins ${pct(seat1Wins / decided)}`);
console.log(`Average length ${(turns / total).toFixed(1)} turns · reached sudden death (turn ${SUDDEN_DEATH_TURN}) ${pct(sudden / total)} · draws ${pct(draws / total)}`);
const seconds = (performance.now() - start) / 1000;
console.log(`${total} fights in ${seconds.toFixed(1)} s (${(total / seconds).toFixed(1)} fights/s)`);
