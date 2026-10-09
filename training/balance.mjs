// Analyse d'équilibrage des personnages : chaque personnage affronte chacun des autres sur de
// nombreuses parties, avec la MÊME IA des deux côtés → seule la différence de personnage compte.
// Le calcul est dans src/AI/Balance.js (partagé avec le Labo d'équilibrage de la page d'entraînement).
//
// Usage :   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/balance.mjs [--games 400] [--agent normal|champion] [--seed 1]
// Sortie :  taux de victoire moyen de chaque personnage (contre tous les autres), ses caractéristiques,
//           ses meilleurs / pires adversaires, et un tableau complet dans
//           ../BoardGameReborn-output/training/balance-<agent>.csv (à côté du projet, jamais sur C:)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBalance } from '../src/AI/Balance.js';
import { SCRIPTED_AGENTS } from '../src/AI/ScriptedAgents.js';
import { createWeightedMoveAgent } from '../src/AI/MoveFeatures.js';
import { CHAMPION_MOVE_WEIGHTS } from '../src/AI/DefaultModels.js';
import { PlayersRepository } from '../src/Repository/PlayersRepository.js';

const args = process.argv.slice(2);
const raw  = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };

const GAMES      = Number(raw('games', 400));   // par paire de personnages (places alternées)
const SEED       = Number(raw('seed', 1));
const AGENT_NAME = raw('agent', 'normal');
const AGENT      = AGENT_NAME === 'champion'
    ? createWeightedMoveAgent(CHAMPION_MOVE_WEIGHTS, { name: 'champion' })
    : SCRIPTED_AGENTS[AGENT_NAME];

const characters = PlayersRepository.findAll().map(p => ({
    name: p.name, characterClass: p.characterClass, health: p.health, maxMove: p.maxMove, strength: p.strength, agility: p.agility, luck: p.luck, image: p.image,
}));
const pct = x => `${(x * 100).toFixed(1).padStart(5)} %`;

const start = performance.now();
const result = runBalance({ characters, agent: AGENT, gamesPerPair: GAMES, seed: SEED });
const seconds = (performance.now() - start) / 1000;

console.log(`Character balance — agent "${AGENT.name}" on both sides, ${GAMES} games per pair, seed ${SEED}`);
console.log(`${result.games} games in ${seconds.toFixed(1)} s · draws ${pct(result.drawRate)} · first player wins ${pct(result.firstPlayerRate)} of decided games\n`);
console.log('character'.padEnd(18) + 'class'.padEnd(10) + 'HP'.padStart(5) + 'PM'.padStart(4) + 'win rate'.padStart(10) + '   best matchup'.padEnd(30) + 'worst matchup');
for (const r of [...result.characters].sort((a, b) => b.winRate - a.winRate)) {
    console.log(
        r.name.padEnd(18) + String(r.characterClass ?? '-').padEnd(10) + String(r.health).padStart(5) + String(r.maxMove).padStart(4) + pct(r.winRate).padStart(10) +
        `   ${r.best.name} ${pct(r.best.rate)}`.padEnd(30) + `${r.worst.name} ${pct(r.worst.rate)}`,
    );
}

// Classe contre classe : moyenne des duels entre personnages des deux classes (diagonale = mêmes classes)
const classes = [...new Set(characters.map(c => c.characterClass).filter(Boolean))];
if (classes.length > 1) {
    console.log('\nClass against class (row beats column):');
    console.log(''.padEnd(10) + classes.map(c => c.padStart(10)).join('') + '   overall');
    for (const a of classes) {
        const cells = classes.map(b => {
            const rates = [];
            characters.forEach((ci, i) => characters.forEach((cj, j) => {
                if (i !== j && ci.characterClass === a && cj.characterClass === b) rates.push(result.matrix[i][j]);
            }));
            return rates.length ? pct(rates.reduce((x, y) => x + y, 0) / rates.length) : '';
        });
        const members = result.characters.filter(c => c.characterClass === a);
        const overall = members.reduce((x, c) => x + c.winRate, 0) / members.length;
        console.log(a.padEnd(10) + cells.map(c => c.padStart(10)).join('') + pct(overall).padStart(10));
    }
}

// Tableau complet (CSV) : ligne = personnage, colonne = adversaire, valeur = taux de victoire
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'BoardGameReborn-output', 'training');
mkdirSync(outDir, { recursive: true });
const csv = [
    ['character', 'health', 'maxMove', 'winRate', ...characters.map(c => c.name)].join(';'),
    ...result.characters.map((c, i) => [c.name, c.health, c.maxMove, c.winRate.toFixed(3),
        ...result.matrix[i].map(rate => (rate === null ? '' : rate.toFixed(3)))].join(';')),
].join('\n');
const file = join(outDir, `balance-${AGENT.name}.csv`);
writeFileSync(file, csv);
console.log(`\nFull matrix saved to ${file}`);
